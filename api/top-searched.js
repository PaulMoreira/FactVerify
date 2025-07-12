// Serverless function for top-searched endpoint with embeddings
const { createClient } = require('@supabase/supabase-js');
const { findSimilarClaims } = require('./utils/embedding-generator');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://czlnbfqkvxyhyhpmdlmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching top searched claims using semantic embeddings');
    
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    // First, get search counts if they exist
    const { data: searchCounts, error: searchError } = await supabase
      .from('search_counts')
      .select('query, count')
      .order('count', { ascending: false })
      .limit(50); // Get more for clustering

    if (searchError) {
      console.error('Error fetching search counts:', searchError);
      return res.status(500).json({ error: 'Failed to fetch top search data' });
    }
    
    let baseQueries = [];
    
    if (searchCounts && searchCounts.length > 0) {
      console.log('Using search_counts table with embeddings for clustering');
      baseQueries = searchCounts.map(item => ({
        query: item.query,
        count: item.count,
        source: 'search_counts'
      }));
    } else {
      console.log('No search_counts found, using recent fact checks for analysis');
      
      // Fallback to recent fact checks
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: factChecks, error } = await supabase
        .from('fact_checks')
        .select('id, query, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Error fetching fact checks:', error);
        throw error;
      }
      
      if (!factChecks || factChecks.length === 0) {
        return res.json({ topSearched: [] });
      }
      
      // Count query frequency
      const queryFrequency = {};
      factChecks.forEach(check => {
        const normalized = check.query.toLowerCase().trim();
        queryFrequency[normalized] = (queryFrequency[normalized] || 0) + 1;
      });
      
      baseQueries = Object.entries(queryFrequency)
        .map(([query, count]) => ({ query, count, source: 'fact_checks' }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
    }
    
    if (baseQueries.length === 0) {
      return res.json({ topSearched: [] });
    }
    
    console.log(`Analyzing ${baseQueries.length} queries for semantic clustering`);
    
    // Group queries using semantic similarity
    const clusters = new Map(); // cluster_id -> { representative: query, members: [queries], totalCount: number }
    const processed = new Set();
    
    for (const queryData of baseQueries) {
      if (processed.has(queryData.query)) continue;
      
      try {
        // Find similar claims using embeddings
        const similarClaims = await findSimilarClaims(
          supabase, 
          queryData.query, 
          0.75, // Lower threshold for broader grouping
          10    // Max similar claims to check
        );
        
        // Create or find existing cluster
        let clusterId = null;
        let bestMatch = null;
        
        // Check if this query should join an existing cluster
        for (const [existingClusterId, cluster] of clusters.entries()) {
          const similarity = similarClaims.find(sim => 
            sim.query.toLowerCase() === cluster.representative.toLowerCase()
          );
          
          if (similarity && similarity.similarity > 0.75) {
            if (!bestMatch || similarity.similarity > bestMatch.similarity) {
              bestMatch = { clusterId: existingClusterId, similarity: similarity.similarity };
            }
          }
        }
        
        if (bestMatch) {
          // Add to existing cluster
          clusterId = bestMatch.clusterId;
          const cluster = clusters.get(clusterId);
          cluster.members.push(queryData);
          cluster.totalCount += queryData.count;
          
          // Update representative if this query has higher count
          if (queryData.count > cluster.representative_count) {
            cluster.representative = queryData.query;
            cluster.representative_count = queryData.count;
          }
        } else {
          // Create new cluster
          clusterId = queryData.query; // Use query as cluster ID
          clusters.set(clusterId, {
            representative: queryData.query,
            representative_count: queryData.count,
            members: [queryData],
            totalCount: queryData.count,
            similar_queries: similarClaims.map(sc => sc.query)
          });
        }
        
        // Mark similar queries as processed to avoid duplicate clusters
        similarClaims.forEach(similar => {
          if (similar.similarity > 0.8) { // High similarity threshold for marking as processed
            processed.add(similar.query);
          }
        });
        
        processed.add(queryData.query);
        
      } catch (error) {
        console.error(`Error processing query "${queryData.query}":`, error);
        
        // Fallback: create individual cluster
        if (!processed.has(queryData.query)) {
          clusters.set(queryData.query, {
            representative: queryData.query,
            representative_count: queryData.count,
            members: [queryData],
            totalCount: queryData.count,
            similar_queries: []
          });
          processed.add(queryData.query);
        }
      }
    }
    
    console.log(`Created ${clusters.size} semantic clusters from ${baseQueries.length} queries`);
    
    // Sort clusters by total search count and get top results
    const sortedClusters = Array.from(clusters.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, limit);
    
    // Get fact check data for representative queries
    const representativeQueries = sortedClusters.map(cluster => cluster.representative);
    
    const { data: factChecks, error: factError } = await supabase
      .from('fact_checks')
      .select('id, query, result')
      .in('query', representativeQueries);
    
    if (factError) {
      console.error('Error fetching fact checks for representatives:', factError);
      // Continue without fact check data
    }
    
    // Build final result
    const topSearched = sortedClusters.map(cluster => {
      // Find matching fact check
      const factCheck = factChecks?.find(fc => 
        fc.query.toLowerCase() === cluster.representative.toLowerCase()
      );
      
      let verdict = 'unknown';
      if (factCheck) {
        try {
          if (factCheck.result) {
            const resultObj = typeof factCheck.result === 'string' 
              ? JSON.parse(factCheck.result) 
              : factCheck.result;
            verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : 'unknown';
          }
        } catch (err) {
          console.error('Error parsing result:', err);
        }
      }
      
      const result = {
        id: factCheck?.id || `cluster-${cluster.representative.slice(0, 10)}`,
        query: cluster.representative,
        verdict: verdict,
        count: cluster.totalCount
      };
      
      // Include similar queries if there are multiple in the cluster
      if (cluster.members.length > 1 || cluster.similar_queries.length > 0) {
        const allSimilar = [
          ...cluster.members.map(m => m.query),
          ...cluster.similar_queries
        ].filter((q, i, arr) => 
          arr.indexOf(q) === i && q.toLowerCase() !== cluster.representative.toLowerCase()
        );
        
        if (allSimilar.length > 0) {
          result.similar_queries = allSimilar.slice(0, 5); // Limit for response size
        }
      }
      
      return result;
    });
    
    console.log(`Successfully generated ${topSearched.length} top searched clusters`);
    res.json({ topSearched });
    
  } catch (error) {
    console.error('Error fetching top searched claims:', error);
    res.status(500).json({ error: 'Failed to fetch top searched claims' });
  }
};

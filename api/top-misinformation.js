// Serverless function for top-misinformation endpoint with embeddings
const { createClient } = require('@supabase/supabase-js');
const { findSimilarClaims } = require('./utils/embedding-generator');
require('dotenv').config();

/**
 * Determine danger level based on query content and verdict
 * @param {string} query - The query text
 * @param {string} verdict - The fact check verdict
 * @returns {string} - Danger level: critical, high, medium, low
 */
function assessDangerLevel(query, verdict) {
  const queryLower = query.toLowerCase();
  
  // Critical danger keywords (health/safety threats)
  const criticalKeywords = [
    'bleach', 'poison', 'toxic', 'deadly', 'kill', 'suicide', 'murder',
    'drink', 'inject', 'consume', 'cure', 'treatment', 'medicine'
  ];
  
  // High danger keywords (public health, democracy, violence)
  const highKeywords = [
    'vaccine', 'covid', 'virus', 'disease', 'election', 'voting', 'vote',
    'violence', 'riot', 'bomb', 'weapon', 'attack', 'conspiracy'
  ];
  
  // Medium danger keywords (misinformation categories)
  const mediumKeywords = [
    'government', 'climate', 'science', 'research', 'study', 'hoax',
    'fake', 'lies', 'control', 'tracking', 'surveillance'
  ];
  
  // Only false/misleading verdicts are considered misinformation
  if (!['false', 'mostly false', 'misleading'].includes(verdict)) {
    return 'low';
  }
  
  // Check for critical danger
  if (criticalKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'critical';
  }
  
  // Check for high danger
  if (highKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'high';
  }
  
  // Check for medium danger
  if (mediumKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'medium';
  }
  
  return 'low';
}

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
    console.log('Fetching top misinformation using semantic embeddings clustering');
    
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    // First try misinformation_counts table if it exists
    const { data: misinformationCounts } = await supabase
      .from('misinformation_counts')
      .select('query, count, danger_level')
      .order('count', { ascending: false })
      .limit(100);
    
    let baseMisinformation = [];
    
    if (misinformationCounts && misinformationCounts.length > 0) {
      console.log('Using misinformation_counts table for clustering');
      baseMisinformation = misinformationCounts.map(item => ({
        query: item.query,
        count: item.count,
        danger_level: item.danger_level || 'medium',
        verdict: 'false', // Assumed since it's in misinformation_counts
        source: 'misinformation_counts'
      }));
    } else {
      console.log('No misinformation_counts found, analyzing fact checks for false claims');
      
      // Fallback: get recent false fact checks
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const { data: factChecks, error } = await supabase
        .from('fact_checks')
        .select('id, query, result, created_at')
        .gte('created_at', sixtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(300); // Get more to find enough false claims
      
      if (error) {
        console.error('Error fetching fact checks:', error);
        throw error;
      }
      
      if (!factChecks || factChecks.length === 0) {
        return res.json({ topMisinformation: [] });
      }
      
      // Filter and count misinformation
      const misinformationClaims = [];
      const queryFrequency = {};
      
      factChecks.forEach(check => {
        try {
          if (check.result) {
            const resultObj = typeof check.result === 'string' 
              ? JSON.parse(check.result) 
              : check.result;
            const verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : '';
            
            // Only consider false/misleading claims as misinformation
            if (verdict === 'false' || verdict === 'mostly false' || verdict === 'misleading') {
              const normalizedQuery = check.query.toLowerCase().trim();
              queryFrequency[normalizedQuery] = (queryFrequency[normalizedQuery] || 0) + 1;
              
              // Assess danger level
              const dangerLevel = assessDangerLevel(check.query, verdict);
              
              misinformationClaims.push({
                id: check.id,
                query: check.query,
                verdict: verdict,
                danger_level: dangerLevel,
                created_at: check.created_at,
                count: 1
              });
            }
          }
        } catch (err) {
          console.error('Error parsing result:', err);
        }
      });
      
      if (misinformationClaims.length === 0) {
        return res.json({ topMisinformation: [] });
      }
      
      // Update counts and remove duplicates
      const uniqueMisinformation = new Map();
      misinformationClaims.forEach(claim => {
        const normalizedQuery = claim.query.toLowerCase().trim();
        claim.count = queryFrequency[normalizedQuery] || 1;
        
        if (!uniqueMisinformation.has(normalizedQuery) || 
            new Date(claim.created_at) > new Date(uniqueMisinformation.get(normalizedQuery).created_at)) {
          uniqueMisinformation.set(normalizedQuery, claim);
        }
      });
      
      baseMisinformation = Array.from(uniqueMisinformation.values())
        .sort((a, b) => {
          // Sort by frequency first, then danger level
          const countDiff = b.count - a.count;
          if (countDiff !== 0) return countDiff;
          
          const dangerLevels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
          return (dangerLevels[b.danger_level] || 0) - (dangerLevels[a.danger_level] || 0);
        })
        .slice(0, 50); // Limit for clustering analysis
    }
    
    if (baseMisinformation.length === 0) {
      return res.json({ topMisinformation: [] });
    }
    
    console.log(`Analyzing ${baseMisinformation.length} misinformation claims for semantic clustering`);
    
    // Group misinformation using semantic similarity
    const clusters = new Map();
    const processed = new Set();
    
    for (const misinfoData of baseMisinformation) {
      if (processed.has(misinfoData.query)) continue;
      
      try {
        // Find similar misinformation claims using embeddings
        const similarClaims = await findSimilarClaims(
          supabase, 
          misinfoData.query, 
          0.8, // Higher threshold for misinformation to ensure accuracy
          8    // Max similar claims to check
        );
        
        // Create or find existing cluster
        let clusterId = null;
        let bestMatch = null;
        
        // Check if this query should join an existing cluster
        for (const [existingClusterId, cluster] of clusters.entries()) {
          const similarity = similarClaims.find(sim => 
            sim.query.toLowerCase() === cluster.representative.toLowerCase()
          );
          
          if (similarity && similarity.similarity > 0.8) {
            if (!bestMatch || similarity.similarity > bestMatch.similarity) {
              bestMatch = { clusterId: existingClusterId, similarity: similarity.similarity };
            }
          }
        }
        
        if (bestMatch) {
          // Add to existing cluster
          clusterId = bestMatch.clusterId;
          const cluster = clusters.get(clusterId);
          cluster.members.push(misinfoData);
          cluster.totalCount += misinfoData.count;
          
          // Update cluster danger level to highest
          const dangerLevels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
          if ((dangerLevels[misinfoData.danger_level] || 0) > (dangerLevels[cluster.danger_level] || 0)) {
            cluster.danger_level = misinfoData.danger_level;
          }
          
          // Update representative if this has higher danger or count
          const currentRepDanger = dangerLevels[cluster.representative_danger] || 0;
          const newDanger = dangerLevels[misinfoData.danger_level] || 0;
          
          if (newDanger > currentRepDanger || 
              (newDanger === currentRepDanger && misinfoData.count > cluster.representative_count)) {
            cluster.representative = misinfoData.query;
            cluster.representative_count = misinfoData.count;
            cluster.representative_danger = misinfoData.danger_level;
            cluster.representative_verdict = misinfoData.verdict;
            cluster.representative_id = misinfoData.id;
          }
        } else {
          // Create new cluster
          clusterId = misinfoData.query;
          clusters.set(clusterId, {
            representative: misinfoData.query,
            representative_count: misinfoData.count,
            representative_danger: misinfoData.danger_level,
            representative_verdict: misinfoData.verdict,
            representative_id: misinfoData.id,
            danger_level: misinfoData.danger_level,
            members: [misinfoData],
            totalCount: misinfoData.count,
            similar_queries: similarClaims.map(sc => sc.query)
          });
        }
        
        // Mark similar queries as processed
        similarClaims.forEach(similar => {
          if (similar.similarity > 0.85) {
            processed.add(similar.query);
          }
        });
        
        processed.add(misinfoData.query);
        
      } catch (error) {
        console.error(`Error processing misinformation query "${misinfoData.query}":`, error);
        
        // Fallback: create individual cluster
        if (!processed.has(misinfoData.query)) {
          clusters.set(misinfoData.query, {
            representative: misinfoData.query,
            representative_count: misinfoData.count,
            representative_danger: misinfoData.danger_level,
            representative_verdict: misinfoData.verdict,
            representative_id: misinfoData.id,
            danger_level: misinfoData.danger_level,
            members: [misinfoData],
            totalCount: misinfoData.count,
            similar_queries: []
          });
          processed.add(misinfoData.query);
        }
      }
    }
    
    console.log(`Created ${clusters.size} misinformation clusters from ${baseMisinformation.length} claims`);
    
    // Sort clusters by search frequency first, then danger level
    const sortedClusters = Array.from(clusters.values())
      .sort((a, b) => {
        // Primary sort: total occurrence count (most searched)
        const countDiff = b.totalCount - a.totalCount;
        if (countDiff !== 0) return countDiff;
        
        // Secondary sort: danger level (as tie-breaker)
        const dangerLevels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return (dangerLevels[b.danger_level] || 0) - (dangerLevels[a.danger_level] || 0);
      })
      .slice(0, limit);
    
    // Build final result
    const topMisinformation = sortedClusters.map(cluster => {
      const result = {
        id: cluster.representative_id || `misinfo-cluster-${cluster.representative.slice(0, 10)}`,
        query: cluster.representative,
        verdict: cluster.representative_verdict || 'false',
        danger_level: cluster.danger_level,
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
    
    console.log(`Successfully generated ${topMisinformation.length} top misinformation clusters`);
    res.json({ topMisinformation });
    
  } catch (error) {
    console.error('Error fetching top misinformation:', error);
    res.status(500).json({ error: 'Failed to fetch top misinformation' });
  }
};

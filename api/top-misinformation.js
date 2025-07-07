// Serverless function for top-misinformation endpoint
const { createClient } = require('@supabase/supabase-js');
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
    console.log('Attempting to fetch top misinformation from Supabase');
    
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    // Query Supabase for misinformation occurrence counts first
    const { data: misinformationCounts, error: countsError } = await supabase
      .from('misinformation_counts')
      .select('query, count, danger_level')
      .order('count', { ascending: false })
      .limit(limit * 3); // Get more than we need to ensure we find matches
    
    if (countsError) {
      console.error('Error fetching misinformation counts:', countsError);
      // Fall back to regular fact checks if we can't get misinformation counts
    }
    
    // If we have misinformation counts, use them; otherwise fall back to recent fact checks
    let data;
    if (misinformationCounts && misinformationCounts.length > 0) {
      console.log('Using actual misinformation counts data');
    } else {
      console.log('No misinformation counts found, falling back to recent fact checks');
      
      // Query Supabase for recent fact checks as fallback
      const { data: factCheckData, error } = await supabase
        .from('fact_checks')
        .select('id, query, result')
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Fetch more items since we'll filter for false verdicts
      
      if (error) {
        console.error('Supabase returned an error:', error);
        throw error;
      }
      
      data = factCheckData;
    }
    
    // Error handling for the fallback query is already done above
    
    // Process data based on whether we have misinformation counts or regular fact checks
    const misinformationItems = [];
    
    if (misinformationCounts && misinformationCounts.length > 0) {
      // Get the queries from misinformation counts
      const topQueries = misinformationCounts.map(item => item.query);
      
      // Get fact checks for these queries
      const { data: factChecks, error: factCheckError } = await supabase
        .from('fact_checks')
        .select('id, query, result')
        .in('query', topQueries);
      
      if (factCheckError) {
        console.error('Error fetching fact checks for top misinformation:', factCheckError);
        throw factCheckError;
      }
      
      // Map misinformation counts to fact checks
      for (const countItem of misinformationCounts) {
        // Find matching fact check
        const matchingFactCheck = factChecks.find(check => 
          check.query.toLowerCase() === countItem.query.toLowerCase());
        
        if (matchingFactCheck) {
          try {
            if (matchingFactCheck.result) {
              const resultObj = typeof matchingFactCheck.result === 'string' 
                ? JSON.parse(matchingFactCheck.result) 
                : matchingFactCheck.result;
              const verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : '';
              
              // Only include false claims as misinformation
              if (verdict === 'false') {
                misinformationItems.push({
                  id: matchingFactCheck.id,
                  query: matchingFactCheck.query,
                  verdict: verdict,
                  danger_level: countItem.danger_level || 'medium',
                  count: countItem.count // Use actual occurrence count
                });
                
                // Stop once we have enough items
                if (misinformationItems.length >= limit) {
                  break;
                }
              }
            }
          } catch (err) {
            console.error('Error parsing result for item:', matchingFactCheck.id, err);
          }
        }
      }
    } else {
      // Fall back to processing regular fact checks
      for (const item of data) {
        try {
          if (item.result) {
            const resultObj = typeof item.result === 'string' ? JSON.parse(item.result) : item.result;
            const verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : '';
            
            // Only include false claims as misinformation
            if (verdict === 'false') {
              // Determine danger level from result or assign a default
              const danger_level = resultObj.danger_level || 'medium';
              
              misinformationItems.push({
                id: item.id,
                query: item.query,
                verdict: verdict,
                danger_level: danger_level,
                count: 1 // Default count for fallback
              });
              
              // Stop once we have enough items
              if (misinformationItems.length >= limit) {
                break;
              }
            }
          }
        } catch (err) {
          console.error('Error parsing result for item:', item.id, err);
        }
      }
    }
    
    const topMisinformation = misinformationItems;
    
    console.log('Successfully fetched top misinformation:', topMisinformation.length);
    res.json({ topMisinformation });
  } catch (error) {
    console.error('Error fetching top misinformation:', error);
    res.status(500).json({ error: 'Failed to fetch top misinformation' });
  }
};

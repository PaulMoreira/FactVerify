// Serverless function for top-searched endpoint
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
    console.log('Attempting to fetch top searched claims from Supabase');
    
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    // Query Supabase for search counts first
    const { data: searchCounts, error: searchError } = await supabase
      .from('search_counts')
      .select('query, count')
      .order('count', { ascending: false })
      .limit(limit * 2); // Get more than we need to ensure we find matches
    
    if (searchError) {
      console.error('Error fetching search counts:', searchError);
      throw searchError;
    }
    
    // If no search counts table or no data, fall back to recent fact checks
    let data;
    if (!searchCounts || searchCounts.length === 0) {
      console.log('No search counts found, falling back to recent fact checks');
      
      // Query Supabase for recent fact checks as fallback
      const { data: factCheckData, error } = await supabase
        .from('fact_checks')
        .select('id, query, result')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Supabase returned an error:', error);
        throw error;
      }
      
      data = factCheckData;
    }
    
    // If we have search counts, get the corresponding fact checks
    let topSearched = [];
    
    if (searchCounts && searchCounts.length > 0) {
      console.log('Using actual search counts data');
      
      // Get the queries from search counts
      const topQueries = searchCounts.map(item => item.query);
      
      // Get fact checks for these queries
      const { data: factChecks, error: factCheckError } = await supabase
        .from('fact_checks')
        .select('id, query, result')
        .in('query', topQueries);
      
      if (factCheckError) {
        console.error('Error fetching fact checks for top queries:', factCheckError);
        throw factCheckError;
      }
      
      // Map search counts to fact checks
      topSearched = searchCounts.map(searchItem => {
        // Find matching fact check
        const matchingFactCheck = factChecks.find(check => 
          check.query.toLowerCase() === searchItem.query.toLowerCase());
        
        if (matchingFactCheck) {
          let verdict = 'unknown';
          try {
            if (matchingFactCheck.result) {
              const resultObj = typeof matchingFactCheck.result === 'string' 
                ? JSON.parse(matchingFactCheck.result) 
                : matchingFactCheck.result;
              verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : 'unknown';
            }
          } catch (err) {
            console.error('Error parsing result for item:', matchingFactCheck.id, err);
          }
          
          return {
            id: matchingFactCheck.id,
            query: matchingFactCheck.query,
            verdict: verdict,
            count: searchItem.count // Use actual search count
          };
        }
        return null;
      }).filter(Boolean).slice(0, limit);
    } else {
      // Transform data to include count and extract verdict from result JSON (fallback)
      topSearched = data.map(item => {
        let verdict = 'unknown';
        try {
          if (item.result) {
            const resultObj = typeof item.result === 'string' ? JSON.parse(item.result) : item.result;
            verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : 'unknown';
          }
        } catch (err) {
          console.error('Error parsing result for item:', item.id, err);
        }
        
        return {
          id: item.id,
          query: item.query,
          verdict: verdict,
          count: 1 // Default count for fallback
        };
      });
    }
    
    console.log('Successfully fetched top searched claims:', topSearched.length);
    res.json({ topSearched });
  } catch (error) {
    console.error('Error fetching top searched claims:', error);
    res.status(500).json({ error: 'Failed to fetch top searched claims' });
  }
};

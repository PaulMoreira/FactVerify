// Serverless function for top-misinformation endpoint
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
// Using local text similarity instead of API-based vector similarity for performance

/**
 * Calculate text similarity between two strings using word overlap
 * This is a simple, fast approximation that doesn't require API calls
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateTextSimilarity(str1, str2) {
  // Convert to lowercase for case-insensitive comparison
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Check for exact match
  if (s1 === s2) return 1.0;
  
  // Check for substring
  if (s1.includes(s2) || s2.includes(s1)) {
    const longerLength = Math.max(s1.length, s2.length);
    const shorterLength = Math.min(s1.length, s2.length);
    return shorterLength / longerLength * 0.9; // 0.9 as it's not an exact match
  }
  
  // Count word overlap
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  return overlap / Math.max(words1.size, words2.size);
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
    console.log('Attempting to fetch top misinformation from Supabase');
    
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    // Query Supabase for misinformation occurrence counts first
    const { data: misinformationCounts, error: countsError } = await supabase
      .from('misinformation_counts')
      .select('query, count, danger_level')
      .order('count', { ascending: false })
      .limit(limit * 5); // Get more to account for grouping similar claims
    
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
        .limit(limit * 3); // Fetch more items since we'll filter for false verdicts
      
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
      console.time('grouping-misinformation');
      
      // Group similar queries and combine their counts
      const groupedCounts = new Map(); // Map of representative query -> total count
      const groupMembers = new Map(); // Map of representative query -> array of similar queries
      const groupDangerLevel = new Map(); // Map of representative query -> highest danger level
      
      // Extract all queries for batch processing
      const allQueries = misinformationCounts.map(item => item.query);
      
      // First, check if we have pre-computed similarity groups in the database
      const { data: similarityGroups } = await supabase
        .from('claim_similarity_groups')
        .select('representative_query, similar_queries')
        .contains('similar_queries', allQueries);
      
      // If we have pre-computed groups, use them
      if (similarityGroups && similarityGroups.length > 0) {
        console.log('Using pre-computed similarity groups for misinformation');
        
        // Process each query
        for (const countItem of misinformationCounts) {
          let isGrouped = false;
          
          // Check if this query belongs to any pre-computed group
          for (const group of similarityGroups) {
            if (group.similar_queries.includes(countItem.query)) {
              const representativeQuery = group.representative_query;
              
              // Initialize the group if it doesn't exist
              if (!groupMembers.has(representativeQuery)) {
                groupMembers.set(representativeQuery, []);
                groupedCounts.set(representativeQuery, 0);
                groupDangerLevel.set(representativeQuery, 'low');
              }
              
              // Add this query to the group
              groupMembers.get(representativeQuery).push(countItem.query);
              // Add the count to the group total
              groupedCounts.set(representativeQuery, groupedCounts.get(representativeQuery) + countItem.count);
              
              // Update danger level if this one is higher
              const currentDangerLevel = groupDangerLevel.get(representativeQuery) || 'low';
              const dangerLevels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
              if ((dangerLevels[countItem.danger_level] || 0) > (dangerLevels[currentDangerLevel] || 0)) {
                groupDangerLevel.set(representativeQuery, countItem.danger_level);
              }
              
              isGrouped = true;
              break;
            }
          }
          
          // If not grouped with any existing group, create a new group
          if (!isGrouped) {
            groupedCounts.set(countItem.query, countItem.count);
            groupMembers.set(countItem.query, [countItem.query]);
            groupDangerLevel.set(countItem.query, countItem.danger_level || 'medium');
          }
        }
      } else {
        // Fall back to on-the-fly grouping with optimizations
        console.log('No pre-computed groups found, performing on-the-fly grouping for misinformation');
        
        // Use a simpler approach for on-the-fly grouping: just check the top N queries
        // Sort queries by count to prioritize the most frequent ones
        const sortedQueries = [...misinformationCounts].sort((a, b) => b.count - a.count);
        const topQueries = sortedQueries.slice(0, Math.min(10, sortedQueries.length));
        
        // Create initial groups with the top queries
        for (const item of topQueries) {
          groupedCounts.set(item.query, item.count);
          groupMembers.set(item.query, [item.query]);
          groupDangerLevel.set(item.query, item.danger_level || 'medium');
        }
        
        // For each remaining query, find the best group
        for (const item of sortedQueries.slice(Math.min(10, sortedQueries.length))) {
          let bestGroup = null;
          let highestSimilarity = 0.7; // Minimum threshold
          
          // Only check against the top representative queries
          for (const representativeQuery of groupMembers.keys()) {
            try {
              // Use simple text similarity as a fast approximation
              const similarity = calculateTextSimilarity(item.query, representativeQuery);
              
              if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestGroup = representativeQuery;
              }
            } catch (error) {
              console.error('Error calculating similarity:', error);
            }
          }
          
          if (bestGroup) {
            // Add to the best matching group
            groupMembers.get(bestGroup).push(item.query);
            groupedCounts.set(bestGroup, groupedCounts.get(bestGroup) + item.count);
            
            // Update danger level if this one is higher
            const currentDangerLevel = groupDangerLevel.get(bestGroup) || 'low';
            const dangerLevels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
            if ((dangerLevels[item.danger_level] || 0) > (dangerLevels[currentDangerLevel] || 0)) {
              groupDangerLevel.set(bestGroup, item.danger_level);
            }
          } else {
            // Create a new group
            groupedCounts.set(item.query, item.count);
            groupMembers.set(item.query, [item.query]);
            groupDangerLevel.set(item.query, item.danger_level || 'medium');
          }
        }
      }
      
      console.timeEnd('grouping-misinformation');
      
      console.log(`Grouped ${misinformationCounts.length} misinformation counts into ${groupedCounts.size} semantic groups`);
      
      // Convert the grouped counts to an array and sort by count
      const sortedGroups = Array.from(groupedCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, limit); // Take only the top groups
      
      // Get the representative queries
      const representativeQueries = sortedGroups.map(([query]) => query);
      
      // Get fact checks for these representative queries
      const { data: factChecks, error: factCheckError } = await supabase
        .from('fact_checks')
        .select('id, query, result')
        .in('query', representativeQueries);
      
      if (factCheckError) {
        console.error('Error fetching fact checks for top misinformation:', factCheckError);
        throw factCheckError;
      }
      
      // Map grouped misinformation counts to fact checks
      for (const [query, count] of sortedGroups) {
        // Find matching fact check
        const matchingFactCheck = factChecks.find(check => 
          check.query.toLowerCase() === query.toLowerCase());
        
        if (matchingFactCheck) {
          try {
            if (matchingFactCheck.result) {
              const resultObj = typeof matchingFactCheck.result === 'string' 
                ? JSON.parse(matchingFactCheck.result) 
                : matchingFactCheck.result;
              const verdict = resultObj.verdict ? resultObj.verdict.toLowerCase() : '';
              
              // Only include false claims as misinformation
              if (verdict === 'false' || verdict === 'mostly false' || verdict === 'misleading') {
                // Get the group members for this representative query
                const members = groupMembers.get(query) || [query];
                const dangerLevel = groupDangerLevel.get(query) || 'medium';
                
                misinformationItems.push({
                  id: matchingFactCheck.id,
                  query: matchingFactCheck.query,
                  verdict: verdict,
                  danger_level: dangerLevel,
                  count: count, // Use combined count from group
                  similar_queries: members.length > 1 ? members : undefined // Include similar queries if there are any
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
            if (verdict === 'false' || verdict === 'mostly false' || verdict === 'misleading') {
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

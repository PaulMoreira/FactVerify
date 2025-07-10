// Search API endpoint that connects to the Crawl4AI Python service and Brave Search API
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { simplifyQuery } = require('./utils/query-simplifier');
const { findOrCreateRepresentativeClaim, storeClaimEmbedding } = require('./utils/embedding-generator');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Determine if we're running in a Vercel environment
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Brave Search API configuration
const BRAVE_API_ENABLED = process.env.BRAVE_API_ENABLED === 'true';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY; // Must be provided via environment variables
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

// Debug logging helper
function debugLog(message) {
  // Only log in development environment or if DEBUG is explicitly enabled
  const isDev = process.env.NODE_ENV !== 'production';
  const isDebugEnabled = process.env.DEBUG_LOGGING === 'true';
  
  if (isDev || isDebugEnabled) {
    console.log(`[SEARCH-API] ${message}`);
  }
}

// Log Brave API initialization status
debugLog(`Brave API initialization status: ${BRAVE_API_ENABLED ? 'ENABLED' : 'DISABLED'}`);
debugLog(`Brave API key ${BRAVE_API_KEY ? 'is configured' : 'is missing'} (using environment variable)`);

// Track query simplification metrics
let querySimplificationCount = 0;
let totalQueriesProcessed = 0;

// Search using Brave API
async function searchWithBraveAPI(query, max_results = 5) {
  // Track metrics for all queries
  totalQueriesProcessed++;
  
  debugLog(`[BRAVE-API] Starting search for query: "${query}" with max_results: ${max_results}`);
  debugLog(`[BRAVE-API] Request URL: ${BRAVE_API_URL}`);
  // Count words in query
  const wordCount = query.trim().split(/\s+/).length;
  
  debugLog(`[BRAVE-API] Query length: ${query.length} characters, ${wordCount} words`);
  
  // Check if query exceeds Brave API limits and simplify if needed
  // Brave API limits: max 400 characters and max 50 words
  const CHAR_LIMIT = 400;
  const WORD_LIMIT = 50;
  let searchQuery = query;
  let originalQuery = null;
  
  // Simplify if either limit is exceeded
  if (query.length > CHAR_LIMIT || wordCount > WORD_LIMIT) {
    const simplifiedQuery = simplifyQuery(query);
    if (simplifiedQuery && simplifiedQuery !== query) {
      originalQuery = query;
      searchQuery = simplifiedQuery;
      querySimplificationCount++;
      
      // Log detailed information about the simplification
      debugLog(`[BRAVE-API] Query exceeds limits (${query.length} chars/${wordCount} words). Using simplified query: "${searchQuery}"`);
      debugLog(`[BRAVE-API] Simplification ratio: ${Math.round((searchQuery.length / query.length) * 100)}% of original length`);
      debugLog(`[BRAVE-API] Total queries simplified: ${querySimplificationCount}/${totalQueriesProcessed} (${Math.round((querySimplificationCount/totalQueriesProcessed) * 100)}%)`);
    }
  }
  
  // Only log masked API key in development
  if (process.env.NODE_ENV !== 'production' && BRAVE_API_KEY) {
    const maskedKey = `${BRAVE_API_KEY.substring(0, 5)}...${BRAVE_API_KEY.substring(BRAVE_API_KEY.length - 4)}`;
    debugLog(`[BRAVE-API] Using API key: ${maskedKey}`);
  } else if (!BRAVE_API_KEY) {
    debugLog(`[BRAVE-API] Error: API key not configured in environment variables`);
    throw new Error('Brave API key not configured');
  }
  
  const requestStart = Date.now();
  
  try {
    debugLog(`[BRAVE-API] Sending request to Brave Search API...`);
    const response = await axios.get(BRAVE_API_URL, {
      params: {
        q: searchQuery, // Use potentially simplified query
        count: max_results,
        result_filter: 'web,news,discussions',
        freshness: 'pd',
        extra_snippets: true,
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
      },
      timeout: 10000 // 10-second timeout
    });
    
    const requestDuration = Date.now() - requestStart;
    debugLog(`[BRAVE-API] Response received in ${requestDuration}ms with status code: ${response.status}`);
    
    if (response.status !== 200) {
      // Log error response in development only
      if (process.env.NODE_ENV !== 'production') {
        debugLog(`[BRAVE-API] Error response: ${JSON.stringify(response.data)}`);
      } else {
        debugLog(`[BRAVE-API] Error response received with status code ${response.status}`);
      }
      throw new Error(`Brave API request failed with status code ${response.status}`);
    }
    
    // Process Brave API response
    const braveData = response.data;
    
    // Only log response structure in development
    if (process.env.NODE_ENV !== 'production') {
      debugLog(`[BRAVE-API] Response data structure: ${Object.keys(braveData).join(', ')}`);
    }
    
    const results = [];
    
    // Extract web search results
    if (braveData.web && braveData.web.results) {
      debugLog(`[BRAVE-API] Found ${braveData.web.results.length} web results`);
      braveData.web.results.forEach((item, index) => {
        results.push({
          title: item.title || 'No Title',
          url: item.url || '',
          content: item.description || ''
        });
        
        // Only log detailed result info in development
        if (process.env.NODE_ENV !== 'production') {
          debugLog(`[BRAVE-API] Web result ${index + 1}: ${item.title} (${item.url})`);
        }
      });
    } else {
      debugLog(`[BRAVE-API] No web results found in response`);
    }
    
    // Extract news results if available and needed to reach max_results
    if (results.length < max_results && braveData.news && braveData.news.results) {
      debugLog(`[BRAVE-API] Found ${braveData.news.results.length} news results`);
      braveData.news.results.forEach((item, index) => {
        if (results.length < max_results) {
          results.push({
            title: item.title || 'No Title',
            url: item.url || '',
            content: item.description || ''
          });
          
          // Only log detailed result info in development
          if (process.env.NODE_ENV !== 'production') {
            debugLog(`[BRAVE-API] News result ${index + 1}: ${item.title} (${item.url})`);
          }
        }
      });
    }
    
    debugLog(`[BRAVE-API] Search completed successfully with ${results.length} total results`);
    
    // Return the structured results with original query info if simplified
    const responseObject = {
      results,
      search_engine: 'Brave Search API',
      is_mock: false
    };
    
    // Add original query info if we used a simplified query
    if (originalQuery) {
      responseObject.used_simplified_query = true;
      responseObject.original_query = originalQuery;
      responseObject.simplified_query = searchQuery;
      responseObject.search_engine = 'Brave Search API (Simplified Query)';
    }
    
    return responseObject;
  } catch (error) {
    debugLog(`[BRAVE-API] Search failed: ${error.message}`);
    debugLog(`[BRAVE-API] Error stack: ${error.stack}`);
    throw error;
  }
}

// Generate mock search results when search services are unavailable
function generateMockSearchResults(query, max_results = 5) {
  const results = [];
  
  // Add a disclaimer result
  results.push({
    title: 'Search Service Notice',
    url: '',
    content: `The Crawl4AI search service is currently unavailable. Using simulated search results for "${query}". For accurate fact-checking, please verify with multiple sources.`
  });
  
  // Extract key terms from the query for better mock results
  const queryTerms = query.toLowerCase().split(' ');
  const politicalTerms = ['president', 'senator', 'congress', 'bill', 'law', 'policy', 'election', 'vote', 'democrat', 'republican'];
  
  // Check if query contains names of politicians or political terms
  const hasPoliticalContext = queryTerms.some(term => 
    politicalTerms.includes(term) || 
    ['trump', 'biden', 'harris', 'mcconnell', 'pelosi', 'schumer'].includes(term)
  );
  
  // Generate relevant mock results based on query content
  if (hasPoliticalContext) {
    results.push({
      title: 'Political Fact Check Database',
      url: 'https://www.politifact.com/',
      content: `For claims related to "${query}", multiple fact-checking organizations have published analyses. Consider consulting established fact-checkers for accurate information.`
    });
    
    results.push({
      title: 'Congressional Record',
      url: 'https://www.congress.gov/',
      content: `Official records related to legislation, votes, and congressional statements can be found in the Congressional Record and other government databases.`
    });
  }
  
  // Add general information sources
  results.push({
    title: 'News Archive Search',
    url: 'https://news.google.com/',
    content: `Historical news coverage may provide context for claims like "${query}". Consider searching news archives from multiple sources to verify information.`
  });
  
  // Limit to requested number of results
  return results.slice(0, max_results);
}

// Validate HTTP status codes
exports.validateStatus = function(status) {
  // Accept any status code to handle it ourselves
  return true;
};

// Combine search results from multiple providers
async function combinedSearch(query, max_results = 5) {
  debugLog(`Performing combined search for: ${query}`);
  const results = [];
  const uniqueUrls = new Set();
  let searchEngine = 'Combined Search';
  let isMock = false;
  
  // Try Brave API first
  if (BRAVE_API_ENABLED) {
    try {
      const braveResults = await searchWithBraveAPI(query, Math.ceil(max_results / 2));
      braveResults.results.forEach(result => {
        if (!uniqueUrls.has(result.url)) {
          results.push(result);
          uniqueUrls.add(result.url);
        }
      });
      searchEngine = `${searchEngine} (Brave API)`;
    } catch (error) {
      debugLog(`Brave API failed in combined search: ${error.message}`);
    }
  }
  
  // Determine the Crawl4AI service URL
  let crawl4aiUrl;
  if (IS_VERCEL) {
    const baseUrl = process.env.CRAWL4AI_SERVICE_URL;
    if (baseUrl) {
      crawl4aiUrl = `${baseUrl.replace(/\/$/, '')}/search`;
    }
  } else {
    crawl4aiUrl = 'http://localhost:3002/search';
  }
  
  // Try Crawl4AI if available
  if (crawl4aiUrl) {
    try {
      const remainingResults = max_results - results.length;
      if (remainingResults > 0) {
        const response = await axios.post(crawl4aiUrl, { query, max_results: remainingResults }, {
          timeout: 75000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          validateStatus: exports.validateStatus
        });
        
        if (response.status === 200) {
          response.data.results.forEach(result => {
            if (!uniqueUrls.has(result.url)) {
              results.push(result);
              uniqueUrls.add(result.url);
            }
          });
          searchEngine = results.length > 0 ? 
            `${searchEngine}, Crawl4AI` : 
            'Crawl4AI';
        }
      }
    } catch (error) {
      debugLog(`Crawl4AI failed in combined search: ${error.message}`);
    }
  }
  
  // If we have no results, use mock results
  if (results.length === 0) {
    const mockResults = generateMockSearchResults(query, max_results);
    results.push(...mockResults);
    searchEngine = 'Mock Search (All services failed)';
    isMock = true;
  }
  
  return {
    results: results.slice(0, max_results),
    search_engine: searchEngine,
    is_mock: isMock
  };
}

module.exports = async (req, res) => {
  // Start timing the request
  const startTime = Date.now();
  debugLog(`Search API called at ${new Date().toISOString()}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { query, max_results = 5, provider = 'auto' } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    // Log the requested provider
    debugLog(`Search provider requested: ${provider}`);

    // Verify the internal API call secret to prevent public access
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const authHeader = req.headers.authorization;
    debugLog(`Received Authorization header: ${authHeader}`);

    // If the secret is configured, we must validate it.
    if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
      debugLog('Unauthorized internal API call attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    debugLog(`Searching for: ${query}`);
    
    // Track the search query in Supabase with semantic similarity grouping
    try {
      // First, store the embedding for this query
      try {
        await storeClaimEmbedding(supabase, query);
        debugLog(`Stored embedding for query: ${query}`);
      } catch (embeddingError) {
        console.error('Error storing query embedding:', embeddingError);
        // Continue with search even if embedding storage fails
      }
      
      // Find or create a representative claim for semantic grouping
      let representativeQuery;
      try {
        representativeQuery = await findOrCreateRepresentativeClaim(supabase, query, 0.8);
        debugLog(`Using representative query: "${representativeQuery}" for search tracking`);
      } catch (embeddingError) {
        console.error('Error finding representative query:', embeddingError);
        representativeQuery = query; // Fall back to original query
      }
      
      // Increment the search count for the representative query
      const { error } = await supabase.rpc('increment_search_count', { search_query: representativeQuery });
      if (error) {
        console.error('Error tracking search query:', error);
      } else {
        debugLog(`Successfully tracked search query using representative query: ${representativeQuery}`);
      }
    } catch (trackingError) {
      console.error('Error calling increment_search_count function:', trackingError);
      // Continue with search even if tracking fails
    }
    
    // Handle provider selection
    if (provider === 'brave' && BRAVE_API_ENABLED) {
      try {
        debugLog('Using Brave Search API as requested.');
        const braveResults = await searchWithBraveAPI(query, max_results);
        return res.status(200).json(braveResults);
      } catch (braveError) {
        debugLog(`Brave API failed: ${braveError.message}. Falling back to auto provider selection.`);
        // Fall through to auto selection
      }
    } else if (provider === 'combined') {
      try {
        debugLog('Using combined search as requested.');
        const combinedResults = await combinedSearch(query, max_results);
        return res.status(200).json(combinedResults);
      } catch (combinedError) {
        debugLog(`Combined search failed: ${combinedError.message}. Falling back to auto provider selection.`);
        // Fall through to auto selection
      }
    }
    
    // For 'crawl4ai' provider or 'auto' provider or fallback from errors above
    
    // For auto provider or fallbacks, try Brave API first if enabled
    if (provider !== 'crawl4ai' && BRAVE_API_ENABLED) {
      try {
        debugLog('Auto mode: Attempting to use Brave Search API first.');
        let braveResults = await searchWithBraveAPI(query, max_results);
        
        // If Brave API returns no results, try with a simplified query before falling back
        if (!braveResults.results || braveResults.results.length === 0) {
          debugLog('Brave API returned zero results on initial query. Trying with simplified query.');
          const simplifiedQueryText = simplifyQuery(query);

          if (simplifiedQueryText && simplifiedQueryText !== query) {
            // We can call searchWithBraveAPI again, it has the simplification logic built-in
            // but we call it with the simplified text directly to ensure it runs.
            braveResults = await searchWithBraveAPI(simplifiedQueryText, max_results);
            if (braveResults.results && braveResults.results.length > 0) {
                // Manually adjust the response to show it came from a simplified query retry
                braveResults.used_simplified_query = true;
                braveResults.original_query = query;
                braveResults.simplified_query = simplifiedQueryText;
                braveResults.search_engine = 'Brave Search API (Simplified Query)';
            }
          } else {
            debugLog('Query simplification did not produce a different query. Not retrying.');
          }
        }

        // Check if Brave API returned results after either attempt
        if (braveResults.results && braveResults.results.length > 0) {
          debugLog(`Brave API returned ${braveResults.results.length} results. Using these results.`);
          return res.status(200).json(braveResults);
        } else {
          debugLog('Brave API returned zero results after all attempts. Falling back to Crawl4AI if available.');
        }
      } catch (braveError) {
        debugLog(`Brave API failed: ${braveError.message}. Falling back to Crawl4AI if available.`);
      }
    }
    
    // Determine the correct Crawl4AI service URL based on the environment.
    let crawl4aiUrl;
    if (IS_VERCEL) {
      const baseUrl = process.env.CRAWL4AI_SERVICE_URL;
      // Ensure the URL points to the /search endpoint.
      if (baseUrl) {
        // Remove trailing slash if it exists, then add /search
        crawl4aiUrl = `${baseUrl.replace(/\/$/, '')}/search`;
      }
    } else {
      // For local development, use the local Python service.
      crawl4aiUrl = 'http://localhost:3002/search';
    }

    // If Crawl4AI is not available and we're using auto provider selection
    if (!crawl4aiUrl && provider !== 'crawl4ai') {
      debugLog('CRAWL4AI_SERVICE_URL is not configured for this environment.');
      
      // Try with simplified query if original query returned no results
      if (BRAVE_API_ENABLED) {
        const simplifiedQueryText = simplifyQuery(query);
        if (simplifiedQueryText && simplifiedQueryText !== query) {
          debugLog(`Trying simplified query: "${simplifiedQueryText}"`);
          
          try {
            const simplifiedResults = await searchWithBraveAPI(simplifiedQueryText, max_results);
            if (simplifiedResults.results && simplifiedResults.results.length > 0) {
              debugLog(`Simplified query returned ${simplifiedResults.results.length} results`);
              // Mark these results as coming from a simplified query
              simplifiedResults.search_engine = `${simplifiedResults.search_engine} (Simplified Query)`;
              simplifiedResults.used_simplified_query = true;
              simplifiedResults.original_query = query;
              simplifiedResults.simplified_query = simplifiedQueryText;
              return res.status(200).json(simplifiedResults);
            }
          } catch (simplifiedError) {
            debugLog(`Simplified query search failed: ${simplifiedError.message}`);
          }
        }
      }
      
      debugLog('All search attempts failed. Using mock results.');
      const mockResults = generateMockSearchResults(query, max_results);
      return res.status(200).json({
        results: mockResults,
        search_engine: 'Mock Search (No search services configured)',
        is_mock: true
      });
    }

    // If we specifically requested Crawl4AI or we're still in the auto flow
    let response = null;
    let lastError = null;

    // Only try Crawl4AI if we have a URL or specifically requested it
    if (crawl4aiUrl || provider === 'crawl4ai') {
      try {
        if (!crawl4aiUrl && provider === 'crawl4ai') {
          throw new Error('CRAWL4AI_SERVICE_URL is not configured but Crawl4AI provider was specifically requested');
        }
        
        debugLog(`Attempting to connect to Crawl4AI at: ${crawl4aiUrl}`);
        response = await axios.post(crawl4aiUrl, { query, max_results }, {
          timeout: 75000, // 75-second timeout to accommodate Render's cold starts
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          validateStatus: exports.validateStatus
        });

        // Log the response status
        debugLog(`Response from ${crawl4aiUrl} - Status: ${response.status}`);

        // If the response is not 200, treat it as a failure.
        if (response.status !== 200) {
          lastError = new Error(`Request failed with status code ${response.status}`);
          debugLog(`Failed to connect to Crawl4AI at: ${crawl4aiUrl} - ${lastError.message}`);
          response = null; // Set response to null to trigger the fallback logic
        } else {
          debugLog(`Successfully connected to Crawl4AI at: ${crawl4aiUrl}`);
        }
      } catch (err) {
        lastError = err;
        debugLog(`Failed to connect to Crawl4AI at: ${crawl4aiUrl} - ${err.message}`);
        response = null; // Ensure response is null on error
      }
    } else {
      debugLog('Skipping Crawl4AI attempt as URL is not configured and not specifically requested');
    }
    
    // If both Brave API and Crawl4AI failed or returned no results, try with simplified query
    if (!response && provider !== 'crawl4ai' && BRAVE_API_ENABLED) {
      const simplifiedQueryText = simplifyQuery(query);
      if (simplifiedQueryText && simplifiedQueryText !== query) {
        debugLog(`Trying simplified query with Brave API: "${simplifiedQueryText}"`);
        
        try {
          const simplifiedResults = await searchWithBraveAPI(simplifiedQueryText, max_results);
          if (simplifiedResults.results && simplifiedResults.results.length > 0) {
            debugLog(`Simplified query returned ${simplifiedResults.results.length} results`);
            // Mark these results as coming from a simplified query
            simplifiedResults.search_engine = `${simplifiedResults.search_engine} (Simplified Query)`;
            simplifiedResults.used_simplified_query = true;
            simplifiedResults.original_query = query;
            simplifiedResults.simplified_query = simplifiedQueryText;
            return res.status(200).json(simplifiedResults);
          }
        } catch (simplifiedError) {
          debugLog(`Simplified query search failed: ${simplifiedError.message}`);
        }
      }
    }
    
    if (!response) {
      const errorMessage = lastError ? lastError.message : 'Crawl4AI search failed or was skipped';
      debugLog(errorMessage);
      
      // If we specifically requested Crawl4AI and it failed, return an error
      if (provider === 'crawl4ai') {
        return res.status(503).json({
          error: 'Crawl4AI service unavailable',
          message: errorMessage
        });
      }
      
      // Try Brave API as fallback before using mock results (for auto provider)
      if (BRAVE_API_ENABLED && provider === 'auto') {
        try {
          debugLog('Attempting to use Brave Search API as fallback.');
          const braveResults = await searchWithBraveAPI(query, max_results);
          return res.status(200).json(braveResults);
        } catch (braveError) {
          debugLog(`Brave API fallback failed: ${braveError.message}. Using mock results.`);
        }
      } else if (provider === 'auto') {
        debugLog('Brave API not enabled. Using mock results as fallback.');
      }
      
      // Use mock search results when all search services are unavailable
      const mockResults = generateMockSearchResults(query, max_results);
      
      // Return with 200 status but indicate it's mock data
      return res.status(200).json({
        results: mockResults,
        search_engine: 'Mock Search (All search services unavailable)',
        is_mock: true
      });
    }
    
    // Process and return the results
    const results = response.data;
    debugLog(`Search completed in ${Date.now() - startTime}ms`);
    
    // Add a flag to indicate this is real data, not mock
    const responseData = {
      ...results,
      is_mock: false
    };
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error in search API:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

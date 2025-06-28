// Search API endpoint that connects to the Crawl4AI Python service
const axios = require('axios');

// Determine if we're running in a Vercel environment
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Debug logging helper
function debugLog(message) {
  console.log(`[SEARCH-API] ${message}`);
}

// Generate mock search results when Crawl4AI is unavailable
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
    const { query, max_results = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

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
      // For local development, we point to the Python-based Crawl4AI service, which should be running on port 3002.
      crawl4aiUrl = 'http://localhost:3002/search';
    }

    // If no URL is configured for the environment, fall back to mock results.
    if (!crawl4aiUrl) {
      debugLog('CRAWL4AI_SERVICE_URL is not configured for this environment. Using mock results.');
      const mockResults = generateMockSearchResults(query, max_results);
      return res.status(200).json({
        results: mockResults,
        search_engine: 'Mock Search (Crawl4AI service not configured)',
        is_mock: true
      });
    }

    let response = null;
    let lastError = null;

    try {
      debugLog(`Attempting to connect to Crawl4AI at: ${crawl4aiUrl}`);
      response = await axios.post(crawl4aiUrl, { query, max_results }, {
        timeout: 55000, // 55-second timeout to accommodate Render's cold starts
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          // Accept any status code to handle it ourselves
          return true;
        }
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
    
    if (!response) {
      const errorMessage = lastError ? lastError.message : 'All Crawl4AI endpoints failed';
      debugLog(`Search failed: ${errorMessage}`);
      debugLog('Using mock search results as fallback');
      
      // Use mock search results when Crawl4AI is unavailable
      const mockResults = generateMockSearchResults(query, max_results);
      
      // Return with 200 status but indicate it's mock data
      return res.status(200).json({
        results: mockResults,
        search_engine: 'Mock Search (Crawl4AI unavailable)',
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

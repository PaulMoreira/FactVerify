// Search API endpoint that connects to the Crawl4AI Python service
import axios from 'axios';

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

export default async function handler(req, res) {
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
    // TEMPORARY: Hardcoded for debugging. The real secret should come from process.env.
    const internalSecret = 'FactCheckSecret2024';
    const authHeader = req.headers.authorization;
    debugLog(`Received Authorization header: ${authHeader}`);

    // If the secret is configured, we must validate it.
    if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
      debugLog('Unauthorized internal API call attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    debugLog(`Searching for: ${query}`);
    
    // This API's job is to connect to the Crawl4AI Python service.
    // The URLs should only point to instances of that service.
    const crawl4aiUrls = [];

    // 1. Primary URL from environment variable (most specific)
    if (process.env.CRAWL4AI_SERVICE_URL) {
      crawl4aiUrls.push(process.env.CRAWL4AI_SERVICE_URL);
    }

    if (IS_VERCEL) {
      // 2. In Vercel, use the known deployed service URL as a fallback.
      // This should be the URL of your DEPLOYED PYTHON SERVICE.
      crawl4aiUrls.push('https://crawl4ai-service.vercel.app/search');
    } else {
      // 3. For local development, use the local Python service.
      crawl4aiUrls.push('http://localhost:3002/search');
    }
    
    debugLog(`Using Crawl4AI URLs: ${crawl4aiUrls.join(', ')}`);
    
    // If no URLs are available, we'll use the mock search function
    
    let response = null;
    let lastError = null;
    
    // Try each URL in sequence until one works
    for (const url of crawl4aiUrls) {
      try {
        debugLog(`Attempting to connect to Crawl4AI at: ${url}`);
        response = await axios.post(url, { query, max_results }, {
          timeout: 10000, // Increased timeout for potentially slow services
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
        debugLog(`Response from ${url} - Status: ${response.status}`);
        
        // Only consider 200 responses as successful
        if (response.status === 200) {
          debugLog(`Successfully connected to Crawl4AI at: ${url}`);
          break;
        } else {
          // Treat non-200 responses as errors
          lastError = new Error(`Request failed with status code ${response.status}`);
          debugLog(`Failed to connect to Crawl4AI at: ${url} - ${lastError.message}`);
          response = null; // Reset response so we try the next URL
        }
      } catch (err) {
        lastError = err;
        debugLog(`Failed to connect to Crawl4AI at: ${url} - ${err.message}`);
      }
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

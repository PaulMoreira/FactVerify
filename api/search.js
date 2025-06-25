// Search API endpoint that connects to the Crawl4AI Python service
import axios from 'axios';

// Debug logging helper
function debugLog(message) {
  console.log(`[SEARCH-API] ${message}`);
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
    
    debugLog(`Searching for: ${query}`);
    
    // Call our Python Crawl4AI service with multiple fallback options
    const crawl4aiUrls = [
      process.env.CRAWL4AI_URL,
      '/search',
      // Remove the fallback URL that's causing 405 errors
      // 'https://factverify.vercel.app/search'
    ].filter(Boolean); // Filter out undefined/null values
    
    let response = null;
    let lastError = null;
    
    // Try each URL in sequence until one works
    for (const url of crawl4aiUrls) {
      try {
        debugLog(`Attempting to connect to Crawl4AI at: ${url}`);
        response = await axios.post(url, {
          query: query,
          max_results: max_results
        }, {
          timeout: 5000, // 5 second timeout
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        debugLog(`Successfully connected to Crawl4AI at: ${url}`);
        break; // Break the loop if successful
      } catch (err) {
        lastError = err;
        debugLog(`Failed to connect to Crawl4AI at: ${url} - ${err.message}`);
        // Continue to next URL
      }
    }
    
    if (!response) {
      const errorMessage = lastError ? lastError.message : 'All Crawl4AI endpoints failed';
      debugLog(`Search failed: ${errorMessage}`);
      
      // Provide fallback search results when Crawl4AI is unavailable
      return res.status(500).json({ 
        error: 'Unable to retrieve search results',
        message: errorMessage,
        results: [
          {
            title: 'Search Service Unavailable',
            url: '',
            content: 'The search service is currently unavailable. Please try again later or check if the Crawl4AI service is running.'
          }
        ]
      });
    }
    
    // Process and return the results
    const results = response.data;
    debugLog(`Search completed in ${Date.now() - startTime}ms`);
    
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error in search API:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

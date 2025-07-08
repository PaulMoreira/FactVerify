// Serverless function for fact-check endpoint
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

// Determine if we're running in a Vercel environment
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';



// Set to true to enable detailed logging
const DEBUG = true;

// Log only in debug mode
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Initialize Supabase client once
let supabase;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Database operations will be skipped.');
  } else {
    // Log the URL for debugging, but never the key
    debugLog(`Initializing Supabase client with URL: ${supabaseUrl.substring(0, 20)}...`);
    supabase = createClient(supabaseUrl, supabaseKey);
    debugLog('Supabase client initialized successfully.');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  supabase = null; // Ensure supabase is null on error
}

// Initialize OpenAI client with better error handling
const initializeOpenAI = () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OpenAI API key');
      return null;
    }
    console.log('Initializing OpenAI client');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25000, // 25-second timeout
      maxRetries: 2
    });
    console.log('OpenAI client initialized successfully');
    return client;
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
    return null;
  }
};

// Note: We're using the searchWeb function directly instead of through OpenAI Agents API
// to ensure compatibility with serverless environments

// Helper function to store fact check results in Supabase
async function storeFactCheck(claim, result) {
  try {
    debugLog('storeFactCheck called with claim length:', claim?.length, 'result length:', result?.length);
    if (!supabase) {
      debugLog('Supabase client not initialized, skipping storage.');
      return null;
    }
    
    // Validate inputs
    if (!claim || typeof claim !== 'string' || !result || typeof result !== 'string') {
      console.error('Invalid claim or result for storage');
      return null;
    }
    
    // Use 'query' column name to match the database schema
    debugLog('Inserting into fact_checks table with query:', claim.substring(0, 50) + '...');
    const { data, error } = await supabase
      .from('fact_checks')
      .insert([{ query: claim, result, created_at: new Date().toISOString() }])
      .select();
      
    if (error) {
      console.error('Supabase insert error:', error);
      if (error.message.includes('fetch failed')) {
        console.error('Detailed fetch error: Could not connect to Supabase. Check network configuration and SUPABASE_URL.');
      }
      return null;
    }

    if (!data || data.length === 0) {
      debugLog('Insert successful, but no data returned. This might be due to RLS policies.');
      return null;
    }
    
    debugLog('Insert successful, data returned for new record.');
    return data[0];
  } catch (dbError) {
    console.error('Database operation failed:', dbError);
    return null;
  }
}

// Helper function to check if we already have this query cached
async function getExistingFactCheck(query) {
  try {
    if (!supabase) {
      debugLog('Supabase client not initialized, skipping cache check.');
      return null;
    }
    
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .eq('query', query)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Supabase query error:', error);
      return null;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting existing fact check:', error);
    return null;
  }
}

// Web search function that provides intelligent search results for fact-checking using Crawl4AI
async function searchWeb(query) {
  debugLog(`Searching web for: ${query}`);
  
  try {
    // In Vercel environment or when using API routes, we should call our own search API
    // rather than trying to connect directly to the Crawl4AI service
    debugLog('Making call to search API');
    
    // Determine the appropriate search endpoint
    let searchEndpoint;
    
    // This function should call our own /api/search endpoint.
    // That endpoint will then handle connecting to the Crawl4AI service.
    
    if (IS_VERCEL) {
      // In Vercel, we must use the full public URL to call another API route.
      // Vercel provides the deployment URL in the VERCEL_URL environment variable.
      const host = process.env.VERCEL_URL || 'factverify.app'; // Fallback to the known app name
      searchEndpoint = `https://${host}/api/search`;
    } else {
      // For local development, use the local server's URL.
      const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      searchEndpoint = `${apiBaseUrl}/api/search`;
    }
    debugLog(`Calling internal search API at: ${searchEndpoint}`);
    
    // Call the search API with proper error handling
    let searchResults = '';
    
    try {
      // Log the state of the internal secret to diagnose auth issues
      const secretIsDefined = !!process.env.INTERNAL_API_SECRET;
      if (!secretIsDefined) {
        debugLog('Warning: INTERNAL_API_SECRET is not defined. The API call will be unauthorized.');
      }

      debugLog(`Making POST request to: ${searchEndpoint}`);
      const response = await axios.post(searchEndpoint, {
        query: query,
        max_results: 5
      }, {
        timeout: 55000, // 55-second timeout for Vercel Pro plan
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`
        },
        validateStatus: function (status) {
          // Accept any status code to handle it ourselves
          return true;
        }
      });
      
      // Log the response status
      debugLog(`Search API response status: ${response.status}`);
      
      // Log the raw response data for debugging
      debugLog('Raw search API response data:', JSON.stringify(response.data, null, 2));
      
      // Check if the response was successful
      if (response.status !== 200) {
        throw new Error(`Request failed with status code ${response.status}`);
      }
      
      if (response.data && response.data.results) {
        // Format search results in a structured way that's easier for the AI to parse
        searchResults = `Search results for "${query}":\n\n`;
        
        // Store the raw results for later use in structured format
        const rawResults = response.data.results;
        
        // Format for human-readable and AI-parseable format
        rawResults.forEach((result, i) => {
          searchResults += `RESULT ${i + 1}:\n`;
          searchResults += `TITLE: ${result.title}\n`;
          if (result.url) searchResults += `URL: ${result.url}\n`;
          if (result.content) searchResults += `CONTENT: ${result.content}\n\n`;
        });
        
        // Check if these are mock results
        if (response.data.is_mock) {
          searchResults += '\n[Note: These are simulated search results as the search service is currently unavailable]\n';
        }
        
        // Add a structured section specifically for the AI to parse
        // Using a very clear delimiter and format to ensure reliable extraction
        searchResults += '\n\n=== STRUCTURED_SOURCES_FOR_AI START ===\n';
        let structuredSourceCount = 0;
        
        // Debug logging for search results
        console.log(`Processing ${rawResults.length} search results`);
        
        // Store all results in a single array without categorization
        const allSources = [];
        
        // Process all results equally
        rawResults.forEach((result, index) => {
          if (result.title && result.url) {
            // Log the URL being processed
            console.log(`Processing result ${index + 1}: ${result.url}`);
            
            // Add to sources list
            allSources.push(result);
          } else {
            console.log(`❌ Result ${index + 1} missing title or URL, skipping`);
          }
        });
        
        // Add all sources to the structured sources section with a clear, consistent format
        // Format: SOURCE_NUMBER: TITLE | URL
        // This format is explicitly mentioned in the AI prompt for reliable extraction
        allSources.forEach((result, i) => {
          // Ensure title doesn't contain pipe character to maintain format consistency
          const safeTitle = result.title.replace('|', '-');
          searchResults += `SOURCE_${i + 1}: ${safeTitle} | ${result.url}\n`;
          structuredSourceCount++;
        });
        
        // Add a clear ending delimiter
        searchResults += '=== STRUCTURED_SOURCES_FOR_AI END ===\n';
        
        // Log the sources summary for debugging
        console.log(`SUMMARY: Found ${allSources.length} sources`);
        
        // Log the actual source URLs for deeper debugging
        if (allSources.length > 0) {
          console.log('ALL SOURCES:');
          allSources.forEach((result, i) => console.log(`  ${i + 1}. ${result.url}`));
        }
        
        // Debug logging for structured sources
        console.log(`Added ${structuredSourceCount} structured sources for AI extraction`);
        console.log('Structured sources section:');
        const startDelimiter = '=== STRUCTURED_SOURCES_FOR_AI START ===';
        const endDelimiter = '=== STRUCTURED_SOURCES_FOR_AI END ===';
        
        const startIndex = searchResults.indexOf(startDelimiter);
        const endIndex = searchResults.indexOf(endDelimiter);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const structuredSection = searchResults.substring(
            startIndex + startDelimiter.length,
            endIndex
          );
          console.log(structuredSection);
        } else {
          console.log('WARNING: Could not find structured sources section delimiters in formatted results');
        }
      }
      
      // Log the final formatted string before returning
      debugLog('Formatted search results to be used in prompt:', searchResults);

      debugLog('Search completed successfully');
      debugLog('Search results obtained successfully');
    } catch (error) {
      debugLog(`Error calling search API: ${error.message}`);
      searchResults = `Unable to retrieve search results. Proceeding with fact-checking based on general knowledge.\n\n`;
    }
    
    return searchResults;
  } catch (error) {
    console.error('Error in searchWeb function:', error);
    return `Unable to perform web search. Proceeding with fact-checking based on general knowledge.\n\n`;
  }
}

module.exports = async (req, res) => {
  // Start timing the request
  const startTime = Date.now();
  debugLog(`Fact-check API called at ${new Date().toISOString()}`);  
  
  try {
    
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
      console.log('Handling OPTIONS request');
      res.status(200).end();
      return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the query from the request body
    console.log('Request body:', req.body);
    const { query } = req.body || {};
    
    if (!query || typeof query !== 'string') {
      console.log('Invalid query:', query);
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }
    
    console.log(`Processing fact check request for: "${query}"`);

    // Check for cached result in Supabase
    console.log('Checking for cached fact check result');
    try {
      const existingCheck = await getExistingFactCheck(query);
      if (existingCheck && existingCheck.result) {
        console.log('Using cached fact check result');
        try {
          // The cached result is a string; parse it into an object before sending.
          const factCheckResult = JSON.parse(existingCheck.result);
          const endTime = Date.now();
          const processingTime = endTime - startTime;

          // Ensure the response format is consistent with a new fact check
          const responseData = {
            ...factCheckResult,
            processingTime
          };

          return res.status(200).json(responseData);
        } catch (parseError) {
          console.error('Failed to parse cached result, proceeding with new check.', parseError);
          // Fall through to perform a new fact check if cached data is corrupt.
        }
      }
      console.log('No cached result found');
    } catch (dbError) {
      console.error('Error checking for cached result:', dbError);
      // Continue even if database check fails
      console.log('Continuing without database cache');
    }
    
    // Initialize OpenAI
    debugLog('Initializing OpenAI client');
    const openai = initializeOpenAI();
    if (!openai) {
      console.error('Failed to initialize OpenAI client');
      return res.status(500).json({ error: 'Server configuration error: Could not initialize OpenAI client' });
    }
    debugLog('OpenAI client initialized successfully');
    
    // Create a fact check response using OpenAI
    console.log('Creating fact check response using OpenAI');
    
    let factCheckResult = '';
    
    try {
      debugLog('Preparing OpenAI request');
      
      // If all Crawl4AI endpoints failed, we'll continue with a message about that
      let searchResults = '';
      try {
        searchResults = await searchWeb(query);
        debugLog('Search results obtained successfully');
      } catch (error) {
        console.error('Error executing Crawl4AI search:', error);
        searchResults = `Unable to retrieve search results from Crawl4AI at this time. Proceeding with fact-check using AI knowledge only.

Note: For the most accurate fact-checking, please ensure the Crawl4AI Python service is running locally on port 3002 or set the CRAWL4AI_URL environment variable to a valid endpoint.`;
        
        // Log more detailed error information for debugging
        if (error.response) {
          // The request was made and the server responded with a status code outside of 2xx range
          debugLog(`Crawl4AI error response status: ${error.response.status}`);
          debugLog(`Crawl4AI error response headers: ${JSON.stringify(error.response.headers)}`);
          debugLog(`Crawl4AI error response data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          // The request was made but no response was received
          debugLog('Crawl4AI error: No response received from server');
        } else {
          // Something happened in setting up the request
          debugLog(`Crawl4AI error message: ${error.message}`);
        }
      }
      
      if (!searchResults || searchResults.includes('Unable to connect to the Crawl4AI service')) {
        debugLog('Warning: Could not connect to Crawl4AI service, proceeding with limited search results');
      }
      
      // Try with a reliable model that should work in production
      debugLog('Sending request to OpenAI using model: gpt-4.1-mini');
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini", // Use a reliable model with lower latency
        messages: [
          {
            role: "system", 
            content: `You are an expert fact-checker. Your goal is to provide a clear, unbiased, and well-sourced analysis of a given claim.

You will be given a claim and a set of search results. Analyze the search results to determine the veracity of the claim.

You MUST respond with a JSON object. Do not include any other text before or after the JSON object.

The JSON object must have the following structure:
{
  "verdict": "<one of: Mostly True, Mostly False, True, False, Misleading, Unverifiable>",
  "summary": "<a concise, one-sentence summary of the findings>",
  "detailed_analysis": "<A detailed, objective analysis of the claim. Explain the reasoning behind your verdict step-by-step. Break down the claim and evaluate each part based on the provided sources. If the claim is nuanced, explain the different perspectives. This should be a few paragraphs long.>",
  "sources": [
    {"title": "<source 1 title>", "url": "<source 1 url>"},
    {"title": "<source 2 title>", "url": "<source 2 url>"}
  ],
  "confidence": "<one of: High, Medium, Low>"
}

IMPORTANT: For the "sources" field, you MUST extract sources from the search results provided. Look for the section between "=== STRUCTURED_SOURCES_FOR_AI START ===" and "=== STRUCTURED_SOURCES_FOR_AI END ===" delimiters. This section contains sources in the format "SOURCE_X: Title | URL". Parse these and include ALL relevant sources in your response.

Prioritize news sources when available, as they typically provide the most reliable third-party verification. If a source was used to make your conclusion, include it in the array. Even if you're uncertain about the claim, include any sources that provided context or information. Only return an empty array if absolutely no search results are available or relevant.

Example of how to extract sources:
1. Find the section between "=== STRUCTURED_SOURCES_FOR_AI START ===" and "=== STRUCTURED_SOURCES_FOR_AI END ==="
2. For each line starting with "SOURCE_X:", extract the title (before the "|" character) and URL (after the "|" character)
3. Include these sources in your response`
          },
          {
            role: "user",
            content: `Fact check this claim and it's context, tell me if it is true or false: "${query}"

Here are some search results to help you:

${searchResults}`
          }
        ],
        temperature: 0.0,
        max_tokens: 1024,
        top_p: 1.0,
        frequency_penalty: 0.2,
        presence_penalty: 0.0,
      });
      
      console.log('OpenAI response received');
      
      if (completion?.choices?.[0]?.message?.content) {
        const rawContent = completion.choices[0].message.content;
        try {
          // The AI should return a JSON string. We need to parse it.
          factCheckResult = JSON.parse(rawContent);
          console.log('Successfully parsed fact check JSON from OpenAI response');
          
          // Debug logging for sources extraction
          console.log('Sources in AI response:', JSON.stringify(factCheckResult.sources, null, 2));
          if (!factCheckResult.sources || factCheckResult.sources.length === 0) {
            console.log('WARNING: No sources were extracted by the AI model');
          } else {
            console.log(`Found ${factCheckResult.sources.length} sources in AI response`);
          }
        } catch (parseError) {
          console.error('Failed to parse JSON from OpenAI response:', parseError);
          console.error('Raw content from OpenAI was:', rawContent);
          
          // Try to fix common JSON issues with URLs in sources
          try {
            console.log('Attempting to fix malformed JSON response...');
            
            // Fix for truncated URLs in sources array by removing problematic characters
            let fixedJson = rawContent;
            
            // Replace any malformed URL strings that might be causing JSON parsing issues
            fixedJson = fixedJson.replace(/"url":\s*"([^"]*?)\n/g, '"url": "$1"');
            fixedJson = fixedJson.replace(/"url":\s*"([^"]*)$/g, '"url": "$1"');
            
            // Try parsing the fixed JSON
            factCheckResult = JSON.parse(fixedJson);
            console.log('Successfully parsed fixed JSON response');
          } catch (fixError) {
            console.error('Failed to fix and parse JSON:', fixError);
            
            // If all parsing attempts fail, create a structured error object
            factCheckResult = {
              verdict: 'Unverifiable',
              summary: 'Due to a technical error with the AI model, this claim could not be verified. Please try again later.',
              sources: [],
              confidence: 'Low'
            };
          }
        }
      } else {
        console.error('Invalid response format from OpenAI:', JSON.stringify(completion));
        
        // If the OpenAI response is invalid, create a structured error object
        factCheckResult = {
          verdict: 'Unverifiable',
          summary: 'Due to a technical error with the AI model, this claim could not be verified. Please try again later.',
          sources: [],
          confidence: 'Low'
        };
      }
    } catch (error) {
      console.error('Error with OpenAI API call:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', JSON.stringify(error.response.data));
      }
      
      // If the AI call fails, create a structured error object to send to the frontend.
      factCheckResult = {
        verdict: 'Unverifiable',
        summary: 'Due to a technical error with the AI model, this claim could not be verified. Please try again later.',
        sources: [],
        confidence: 'Low'
      };
    }
    
    console.log('Successfully created fact check result');
    
    // Store the result in Supabase. The 'result' column expects a string, so we stringify our JSON object.
    let newFactCheckId = null;
    debugLog('Attempting to store fact check in database');
    try {
      const storedResult = await storeFactCheck(query, JSON.stringify(factCheckResult));
      if (storedResult) {
        debugLog('Fact check successfully stored in database', storedResult);
        newFactCheckId = storedResult.id;
        
        // Track misinformation if the verdict is false
        if (factCheckResult.verdict && factCheckResult.verdict.toLowerCase() === 'false') {
          debugLog('Tracking misinformation for false claim');
          try {
            // Determine danger level based on confidence
            let dangerLevel = 'medium';
            if (factCheckResult.confidence) {
              if (factCheckResult.confidence.toLowerCase() === 'high') {
                dangerLevel = 'high';
              } else if (factCheckResult.confidence.toLowerCase() === 'low') {
                dangerLevel = 'low';
              }
            }
            
            // Call the increment_misinformation_count function
            const { error } = await supabase.rpc('increment_misinformation_count', { 
              misinformation_query: query,
              danger: dangerLevel
            });
            
            if (error) {
              console.error('Error tracking misinformation:', error);
            } else {
              debugLog(`Successfully tracked misinformation for query: ${query}`);
            }
          } catch (trackingError) {
            console.error('Error calling increment_misinformation_count function:', trackingError);
            // Continue even if tracking fails
          }
        }
      } else {
        debugLog('Fact check not stored (null result from storeFactCheck)');
      }
    } catch (storeError) {
      console.error('Error storing fact check:', storeError);
      // Continue even if storage fails, to not block the user response.
    }
    
    // Return the structured JSON response to the client
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    debugLog(`Request completed in ${processingTime}ms`);
    debugLog('Sending response to client');
    
    const responseData = {
      ...factCheckResult,
      id: newFactCheckId,
      processingTime
    };
    
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Error in fact-check handler:', error);
    console.error('Error name:', error?.name || 'unknown');
    console.error('Error message:', error?.message || 'No message available');
    console.error('Error stack:', error?.stack || 'No stack available');
    
    // Return a more user-friendly error message
    return res.status(500).json({ 
      error: `We're experiencing technical difficulties with our fact-checking service. Please try again later.`,
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
}
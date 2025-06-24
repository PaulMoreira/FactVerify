// Serverless function for fact-check endpoint
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Agent, tool, run } from '@openai/agents';
import axios from 'axios';
import 'dotenv/config';

// Set to true to enable detailed logging
const DEBUG = true;

// Log only in debug mode
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Initialize Supabase client
const initializeSupabase = () => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Missing Supabase credentials');
      return null;
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return null;
  }
};

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
      timeout: 60000, // 60 second timeout
      maxRetries: 2
    });
    console.log('OpenAI client initialized successfully');
    return client;
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
    return null;
  }
};

// Crawl4AI search tool implementation for OpenAI Assistants API
const crawl4aiSearchTool = tool({
  name: 'search_web',
  description: 'Search the web for current information about political claims using Crawl4AI',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find information about the claim'
      }
    },
    required: ['query'],
    additionalProperties: false
  },
  execute: async ({ query }) => {
    console.log(`Executing Crawl4AI search for: ${query}`);
    return await searchWeb(query);
  }
});

// Helper function to store fact check results in Supabase
async function storeFactCheck(claim, result) {
  try {
    console.log('storeFactCheck called with claim length:', claim?.length, 'result length:', result?.length);
    const supabase = initializeSupabase();
    if (!supabase) {
      console.log('Supabase client not initialized');
      return null;
    }
    
    // Validate inputs
    if (!claim || typeof claim !== 'string' || !result || typeof result !== 'string') {
      console.error('Invalid claim or result for storage');
      return null;
    }
    
    // Use 'query' column name to match the database schema
    console.log('Inserting into fact_checks table with query:', claim.substring(0, 50) + '...');
    try {
      const { data, error } = await supabase
        .from('fact_checks')
        .insert([{ query: claim, result, created_at: new Date().toISOString() }]);
      
      if (error) {
        console.error('Supabase insert error:', error);
        return null;
      }
      
      console.log('Insert successful, data:', data ? 'Data returned' : 'No data returned');
      return data;
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return null;
    }
  } catch (error) {
    console.error('Error in storeFactCheck:', error);
    return null;
  }
}

// Helper function to check if we already have this query cached
async function getExistingFactCheck(query) {
  try {
    const supabase = initializeSupabase();
    if (!supabase) {
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
    // Call our Python Crawl4AI service
    const response = await axios.post('http://localhost:3002/search' || 'https://factverify.vercel.app/search', {
      query: query,
      max_results: 5
    });
    
    const data = response.data;
    
    // Prepare the search results
    let searchResults = `Crawl4AI search results for "${query}":\n\n`;
    
    // Process the results
    if (data.results && data.results.length > 0) {
      data.results.forEach((result, index) => {
        searchResults += `${index + 1}. ${result.title}\n`;
        if (result.url) {
          searchResults += `   Source: ${result.url}\n`;
        }
        if (result.content) {
          searchResults += `   ${result.content}\n\n`;
        }
      });
    } else if (data.error) {
      searchResults += `${data.error}\n\n`;
      searchResults += 'Suggestions:\n';
      searchResults += '- Try rephrasing the query with more specific details\n';
      searchResults += '- Check if the claim contains verifiable facts rather than opinions\n';
      searchResults += '- Consider searching for individual elements of the claim separately\n';
    } else {
      searchResults += 'No specific information was found for this query. This could be because:\n';
      searchResults += '1. The claim might be very recent and not yet indexed\n';
      searchResults += '2. The claim might be stated in different terms than how it appears in sources\n';
      searchResults += '3. The claim might be about a topic with limited online coverage\n\n';
      searchResults += 'Suggestions:\n';
      searchResults += '- Try rephrasing the query with more specific details\n';
      searchResults += '- Check if the claim contains verifiable facts rather than opinions\n';
      searchResults += '- Consider searching for individual elements of the claim separately\n';
    }
    
    // Add source attribution
    searchResults += `\nSearch powered by: Crawl4AI\n`;
    
    console.log('Crawl4AI search completed successfully');
    
    return searchResults;
  } catch (error) {
    console.error('Error executing Crawl4AI search:', error);
    
    // If the Python service is not running, provide a helpful error message
    if (error.code === 'ECONNREFUSED') {
      return 'Unable to connect to the Crawl4AI service. Please make sure the Python service is running on port 3002. Error: Connection refused.';
    }
    
    return 'Unable to retrieve search results from Crawl4AI at this time. Please try again later. Error details: ' + error.message;
  }
}

export default async function handler(req, res) {
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
      if (existingCheck) {
        console.log('Using cached fact check result');
        return res.json({ result: existingCheck.result });
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
      
      // Get search results first
      debugLog('Getting search results');
      const searchResults = await searchWeb(query);
      debugLog('Search results obtained');
      
      // Try with a reliable model that should work in production
      debugLog('Sending request to OpenAI using model: gpt-4.1-mini');
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini", // Use a reliable model with lower latency
        messages: [
          {
            role: "system", 
            content: `You are a political fact-checking assistant. Your task is to verify the following political claim. Provide a verdict (True, Mostly True, Mixed, Mostly False, False, or Unverifiable), a detailed explanation, and your confidence level (High, Medium, or Low).

Format your response exactly as follows:

Verdict: [Your verdict]

Explanation: [Your detailed explanation]

Sources: [List your sources if available, or state "Based on general knowledge"]

Confidence: [High/Medium/Low]`
          },
          {
            role: "user",
            content: `Fact check this claim: "${query}"

Here are some search results to help you:

${searchResults}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      console.log('OpenAI response received');
      
      if (completion?.choices?.[0]?.message?.content) {
        factCheckResult = completion.choices[0].message.content;
        console.log('Successfully extracted fact check result from OpenAI response');
      } else {
        console.error('Invalid response format from OpenAI:', JSON.stringify(completion));
        throw new Error('Invalid response format from OpenAI');
      }
    } catch (error) {
      console.error('Error with OpenAI API call:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', JSON.stringify(error.response.data));
      }
      
      factCheckResult = `Verdict: Unverifiable

Explanation: Due to technical limitations, I cannot verify this claim at the moment. Please try again later.

Sources: No sources available

Confidence: Low`;
    }
    
    console.log('Successfully created fact check result');
    
    // Add search engine information to the result
    const resultWithSearchInfo = factCheckResult + '\n\n[Search powered by: Crawl4AI]';
    
    // Try to store the result in Supabase, but don't let it block the response
    debugLog('Attempting to store fact check in database');
    try {
      // Use a Promise that won't block the response
      storeFactCheck(query, factCheckResult)
        .then(result => {
          if (result) {
            debugLog('Fact check successfully stored in database');
          } else {
            debugLog('Fact check not stored (null result from storeFactCheck)');
          }
        })
        .catch(error => {
          console.error('Error storing fact check:', error);
        });
    } catch (storeError) {
      console.error('Error setting up storage promise:', storeError);
      // Continue even if storage setup fails
    }
    
    // Return the response
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    debugLog(`Request completed in ${processingTime}ms`);
    debugLog('Sending response to client');
    
    return res.status(200).json({ 
      result: resultWithSearchInfo,
      searchEngine: 'Crawl4AI',
      processingTime: processingTime
    });
    
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

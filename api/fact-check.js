// Serverless function for fact-check endpoint
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Disable OpenAI for now to simplify troubleshooting
// import OpenAI from 'openai';

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

// Simplified OpenAI client initialization - just return true for now
const initializeOpenAI = () => {
  console.log('OpenAI initialization bypassed for troubleshooting');
  return true;
};

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

// Web search function that simulates crawl4ai behavior but works in serverless environment
async function searchWeb(query) {
  console.log(`Searching web for: ${query}`);
  
  try {
    // Return a very simple response to avoid any potential issues
    return `Search results for "${query}":

No detailed search results available at this time.`;
  } catch (error) {
    console.error('Error executing search:', error);
    return 'Unable to retrieve search results at this time.';
  }
}

export default async function handler(req, res) {
  try {
    console.log('Fact-check API called');
    
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

    // Skip database operations for now
    console.log('Skipping database check for troubleshooting');
    
    // Create a simple fact check response
    console.log('Creating a simple fact check response');
    
    // Generate a simple response
    const factCheckResult = `Verdict: Unverifiable

Explanation: This is a test response from the fact-checking service. We are currently troubleshooting the API.

Sources: No sources available

Confidence: Low`;
    
    console.log('Successfully created fact check result');
    
    // Add search engine information to the result
    const resultWithSearchInfo = factCheckResult + '\n\n[Search powered by: Crawl4AI]';
    
    // Skip database storage for troubleshooting
    console.log('Skipping database storage for troubleshooting');
    
    // Return the response
    console.log('Sending response to client');
    return res.status(200).json({ 
      result: resultWithSearchInfo,
      searchEngine: 'Crawl4AI'
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

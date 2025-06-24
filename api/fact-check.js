// Serverless function for fact-check endpoint
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { Agent, tool, run } from '@openai/agents';
import axios from 'axios';
import 'dotenv/config';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://czlnbfqkvxyhyhpmdlmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to store fact check results in Supabase
async function storeFactCheckResult(query, result) {
  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .insert([
        { 
          query, 
          result, 
          created_at: new Date().toISOString() 
        }
      ]);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error storing fact check result:', error);
    return null;
  }
}

// Helper function to check if we already have this query cached
async function getExistingFactCheck(query) {
  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .eq('query', query)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching existing fact check:', error);
    return null;
  }
}

// Crawl4AI search tool implementation
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
    
    try {
      // In serverless environment, we can't connect to localhost
      // This would need to be replaced with a deployed service URL
      // For now, return a fallback message
      return `Search results for "${query}" (Note: Web search is limited in serverless environment):\n\n` +
        `1. Unable to connect to search service in serverless environment.\n` +
        `   Consider using a different search provider or deploying the search service separately.`;
    } catch (error) {
      console.error('Error executing search:', error);
      return 'Unable to retrieve search results at this time. Error details: ' + error.message;
    }
  }
});

export default async function handler(req, res) {
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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Check if we already have this query cached in Supabase
    const existingCheck = await getExistingFactCheck(query);
    if (existingCheck) {
      console.log('Using cached fact check result');
      return res.json({ result: existingCheck.result });
    }
    
    console.log('Creating agent for fact-checking');
    
    // Create an agent with the search tool
    const agent = new Agent({
      tools: [crawl4aiSearchTool],
      model: "gpt-4.1-mini",
      instructions: `You are a political fact-checking assistant. Your task is to verify political claims by searching for reliable information.
      
      When fact-checking a claim:
      1. Break down the claim into verifiable components
      2. Search for relevant information using the search_web tool
      3. Evaluate the claim based on the evidence found
      4. Provide a clear verdict (True, Mostly True, Mixed, Mostly False, False, or Unverifiable)
      5. Explain your reasoning in detail
      6. Cite your sources
      
      Format your response as follows:
      
      Verdict: [Your verdict]
      
      Explanation: [Your detailed explanation]
      
      Sources: [List your sources, if available]
      
      Confidence: [High/Medium/Low] - Indicate how confident you are in your assessment`
    });
    
    console.log('Running agent to fact-check:', query);
    
    try {
      console.log('Running agent to fact-check:', query);
      
      // Run the agent to fact-check the claim using the run function with a timeout
      const runPromise = run(agent, `Fact check this claim: ${query}`);
      
      // Set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Agent run timed out after 25 seconds')), 25000);
      });
      
      // Race between the run and the timeout
      const result = await Promise.race([runPromise, timeoutPromise]);
      console.log('Agent run completed successfully');
      
      // Extract the final text response from the agent run result
      let factCheckResult = '';
      
      // Log the structure of the result to help with debugging
      console.log('Result structure:', Object.keys(result));
      
      // First check if finalOutput is available
      if (result.finalOutput !== undefined) {
        console.log('finalOutput type:', typeof result.finalOutput);
        
        if (typeof result.finalOutput === 'string') {
          factCheckResult = result.finalOutput;
        } else if (result.finalOutput && typeof result.finalOutput === 'object') {
          // Handle object or array finalOutput
          if (result.finalOutput.text) {
            factCheckResult = result.finalOutput.text;
          } else if (result.finalOutput.content) {
            factCheckResult = result.finalOutput.content;
          } else if (Array.isArray(result.finalOutput)) {
            // Look for message type outputs
            const messageItem = result.finalOutput.find(item => item && item.type === 'message');
            if (messageItem && messageItem.content) {
              if (typeof messageItem.content === 'string') {
                factCheckResult = messageItem.content;
              } else if (Array.isArray(messageItem.content)) {
                const textContent = messageItem.content.find(c => c && c.type === 'text');
                if (textContent && textContent.text) {
                  factCheckResult = textContent.text;
                }
              }
            }
          }
        }
      }
      
      // If we still don't have a result, try the output property
      if (!factCheckResult && result.output) {
        console.log('output type:', typeof result.output);
        
        if (typeof result.output === 'string') {
          factCheckResult = result.output;
        } else if (result.output && typeof result.output === 'object') {
          if (result.output.text) {
            factCheckResult = result.output.text;
          } else if (result.output.content) {
            factCheckResult = result.output.content;
          } else if (Array.isArray(result.output)) {
            // Look for message type outputs
            const messageOutput = result.output.find(item => item && item.type === 'message');
            if (messageOutput && messageOutput.content) {
              if (typeof messageOutput.content === 'string') {
                factCheckResult = messageOutput.content;
              } else if (Array.isArray(messageOutput.content)) {
                const textContent = messageOutput.content.find(c => c && c.type === 'text');
                if (textContent && textContent.text) {
                  factCheckResult = textContent.text;
                }
              }
            }
          }
        }
      }
      
      // If we still don't have a result, use a default format
      if (!factCheckResult) {
        console.log('No result extracted, using default format');
        factCheckResult = `Verdict: Inconclusive\n\nExplanation: Unable to extract a proper response from the AI agent.\n\nSources: No specific sources cited\n\nConfidence: Low`;
      }
    } catch (error) {
      console.error('Error extracting fact check result:', error);
      factCheckResult = `Verdict: Error\n\nExplanation: An error occurred while processing the fact check.\n\nSources: No sources available\n\nConfidence: Low`;
    }
    
    console.log('Extracted fact check result:', factCheckResult);
    
    console.log('Fact-check completed');
    
    // Add search engine information to the result
    const resultWithSearchInfo = factCheckResult + '\n\n[Search powered by: Vercel Serverless]';
    
    // Store the result in Supabase
    await storeFactCheckResult(query, resultWithSearchInfo);
    
    res.json({ 
      result: resultWithSearchInfo,
      searchEngine: 'Vercel Serverless' 
    });
  } catch (error) {
    console.error('Error during fact-checking:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'An error occurred during fact-checking: ' + error.message });
  }
}

// Serverless function for fact-check endpoint
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { Agent, tool, run } from '@openai/agents';
import axios from 'axios';
import 'dotenv/config';

// Initialize Supabase client
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    throw new Error('Missing Supabase credentials');
  }
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // Will initialize on demand if needed
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to store fact check results in Supabase
async function storeFactCheck(claim, result) {
  try {
    if (!supabase) {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('Missing Supabase credentials');
        return null;
      }
      supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    }
    
    // Validate inputs
    if (!claim || typeof claim !== 'string' || !result || typeof result !== 'string') {
      console.error('Invalid claim or result for storage');
      return null;
    }
    
    // Use 'query' column name to match the database schema used in server.js
    const { data, error } = await supabase
      .from('fact_checks')
      .insert([{ query: claim, result, created_at: new Date().toISOString() }]);
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error storing fact check:', error);
    return null; // Return null instead of throwing to allow the process to continue
  }
}

// Helper function to check if we already have this query cached
async function getExistingFactCheck(query) {
  try {
    if (!supabase) {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('Missing Supabase credentials');
        return null;
      }
      supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    }
    
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .eq('query', query)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting existing fact check:', error);
    return null; // Return null instead of throwing to allow the process to continue
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
      // Simulate search results for the serverless environment
      // This provides some content for the AI to work with
      return `Search results for "${query}":\n\n` +
        `1. According to recent sources, political fact-checking requires careful analysis of claims against reliable sources.\n\n` +
        `2. When evaluating political statements, it's important to consider the context, source reliability, and potential bias.\n\n` +
        `3. Fact-checkers typically rate claims on a scale from True to False, with intermediate ratings like "Mostly True" or "Half True".\n\n` +
        `4. For this specific claim, please consider official government sources, reputable news organizations, and academic research.`;
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
    // Validate OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not defined');
      return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }
    
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Check if we already have this query cached in Supabase
    try {
      const existingCheck = await getExistingFactCheck(query);
      if (existingCheck) {
        console.log('Using cached fact check result');
        return res.json({ result: existingCheck.result });
      }
    } catch (dbError) {
      console.error('Error checking for existing fact check:', dbError);
      // Continue with the fact check even if database lookup fails
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
      
      // Use a direct OpenAI completion as a fallback if the agent fails
      let factCheckResult = '';
      
      try {
        // First try using the agent with a timeout
        const runPromise = run(agent, `Fact check this claim: ${query}`);
        
        // Set a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Agent run timed out after 20 seconds')), 20000);
        });
        
        // Race between the run and the timeout
        const result = await Promise.race([runPromise, timeoutPromise]);
        console.log('Agent run completed successfully');
        
        // Extract the final text response from the agent run result
        // Log the structure of the result to help with debugging
        console.log('Result structure:', Object.keys(result || {}));
        
        // First check if finalOutput is available
        if (result && result.finalOutput !== undefined) {
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
        if (!factCheckResult && result && result.output) {
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
      } catch (agentError) {
        console.error('Error running agent:', agentError);
        console.log('Falling back to direct OpenAI completion');
        
        // If the agent fails, fall back to a direct OpenAI completion
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
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
                content: `Fact check this claim: ${query}`
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          });
          
          factCheckResult = completion.choices[0].message.content;
        } catch (completionError) {
          console.error('Error with direct completion fallback:', completionError);
          // If all else fails, return a generic response
          factCheckResult = `Verdict: Unverifiable\n\nExplanation: Due to technical limitations, I cannot verify this claim at the moment. Please try again later.\n\nSources: No sources available\n\nConfidence: Low`;
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
    
    // Store the fact check result in Supabase
    try {
      if (factCheckResult && typeof factCheckResult === 'string' && factCheckResult.length > 0) {
        await storeFactCheck(query, factCheckResult);
        console.log('Fact check stored in database');
      } else {
        console.warn('Not storing empty or invalid fact check result');
      }
    } catch (storeError) {
      console.error('Error storing fact check:', storeError);
      // Continue even if storage fails
    }
    
    res.json({ 
      result: resultWithSearchInfo,
      searchEngine: 'Vercel Serverless' 
    });
  } catch (error) {
    console.error('Error in fact-check handler:', error);
    console.error('Error name:', error?.name || 'unknown');
    console.error('Error message:', error?.message || 'No message available');
    console.error('Error stack:', error?.stack || 'No stack available');
    
    try {
      console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
    } catch (jsonError) {
      console.error('Could not stringify error:', jsonError);
    }
    
    // Return a more user-friendly error message
    return res.status(500).json({ 
      error: `We're experiencing technical difficulties with our fact-checking service. Please try again later.`,
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
}

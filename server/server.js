import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { Agent, tool, run } from '@openai/agents';
import axios from 'axios';

const app = express();
// Configure CORS to allow requests from your frontend
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : ['http://localhost:3000', 'https://factverify.vercel.app'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://czlnbfqkvxyhyhpmdlmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseKey) {
  console.error('SUPABASE_KEY environment variable is not set. Please set it in your .env file.');
  process.exit(1);
}
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
      // Call our Python Crawl4AI service
      const response = await axios.post('http://localhost:3002/search', {
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
});

// Endpoint for fact-checking with web search capability
app.post('/fact-check', async (req, res) => {
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
    
    // Create an agent with the Crawl4AI search tool
    const agent = new Agent({
      name: 'fact-checker',
      tools: [crawl4aiSearchTool],
      openai,
      model: 'gpt-4.1-mini',
      instructions: `You are a helpful fact-checking assistant. Your task is to verify political claims by searching the web for relevant information.
      
      When fact-checking a claim:
      1. Search for relevant information using the search_web tool
      2. Analyze the search results carefully
      3. Determine if the claim is True, Mostly True, Mixed, Mostly False, or False
      4. Provide a detailed explanation of your reasoning
      5. Cite specific sources from the search results
      
      Format your response like this:
      
      Verdict: [Your verdict]
      
      Explanation: [Your detailed explanation]
      
      Sources: [List your sources, if available]
      
      Confidence: [High/Medium/Low] - Indicate how confident you are in your assessment`
    });
    
    console.log('Running agent to fact-check:', query);
    
    // Run the agent to fact-check the claim using the run function
    const result = await run(agent, `Fact check this claim: ${query}`);
    
    // Extract the final text response from the agent run result using the recommended approach
    // from the OpenAI Agents SDK documentation
    let factCheckResult = '';
    
    try {
      // First check if finalOutput is available (recommended approach from docs)
      if (result.finalOutput !== undefined) {
        if (typeof result.finalOutput === 'string') {
          factCheckResult = result.finalOutput;
        } else {
          // If finalOutput is an object, stringify it
          factCheckResult = JSON.stringify(result.finalOutput);
        }
      } 
      // If no finalOutput, look for message output in newItems
      else if (result.newItems && Array.isArray(result.newItems)) {
        // Find the last message output item
        const messageItems = result.newItems.filter(item => 
          item.type === 'message_output_item' && item.rawItem?.content);
        
        if (messageItems.length > 0) {
          // Get the last message item
          const lastMessageItem = messageItems[messageItems.length - 1];
          
          // Extract text from content array
          if (lastMessageItem.rawItem.content) {
            const textContent = lastMessageItem.rawItem.content.find(c => c.type === 'text');
            if (textContent && textContent.text) {
              factCheckResult = textContent.text;
            }
          }
        }
      }
      
      // If we still don't have a result, try the output property
      if (!factCheckResult && result.output) {
        if (typeof result.output === 'string') {
          factCheckResult = result.output;
        } else if (Array.isArray(result.output)) {
          // Look for message type outputs
          const messageOutput = result.output.find(item => item.type === 'message');
          if (messageOutput && messageOutput.content) {
            const textContent = messageOutput.content.find(c => c.type === 'text');
            if (textContent && textContent.text) {
              factCheckResult = textContent.text;
            }
          }
        }
      }
      
      // If we still don't have a result, use a default format
      if (!factCheckResult) {
        factCheckResult = `Verdict: Inconclusive\n\nExplanation: Unable to extract a proper response from the AI agent.\n\nSources: No specific sources cited\n\nConfidence: Low`;
      }
    } catch (error) {
      console.error('Error extracting fact check result:', error);
      factCheckResult = `Verdict: Error\n\nExplanation: An error occurred while processing the fact check.\n\nSources: No sources available\n\nConfidence: Low`;
    }
    
    console.log('Extracted fact check result:', factCheckResult);
    
    console.log('Fact-check completed');
    
    // Add search engine information to the result
    const resultWithSearchInfo = factCheckResult + '\n\n[Search powered by: Crawl4AI]';
    
    // Store the result in Supabase
    await storeFactCheckResult(query, resultWithSearchInfo);
    
    res.json({ 
      result: resultWithSearchInfo,
      searchEngine: 'Crawl4AI' 
    });
  } catch (error) {
    console.error('Error during fact-checking:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'An error occurred during fact-checking.' });
  }
});

// Endpoint to get recent fact checks
app.get('/recent-fact-checks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    res.json({ factChecks: data });
  } catch (error) {
    console.error('Error fetching recent fact checks:', error);
    res.status(500).json({ error: 'An error occurred while fetching recent fact checks.' });
  }
});

// Keep the generate-example endpoint for backward compatibility
app.post('/generate-example', async (req, res) => {
  try {
    const { idea, candidateName } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a political analyst providing brief, neutral scenario examples based on candidates' ideas for the 2024 US Presidential election. Your examples should be specific, realistic, and illustrative of how the policy might work in practice." },
        { role: "user", content: `Create a brief, specific scenario example (2-3 sentences) of how ${candidateName}'s idea on "${idea}" might play out in practice if implemented. Be neutral and factual in your description.` }
      ],
      temperature: 1,
      max_tokens: 150,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    res.json({ example: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while generating the example.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
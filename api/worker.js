// api/worker.js: Performs the long-running fact-checking task.
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log('[WORKER]', ...args);
}

// Initialize Supabase and OpenAI clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Helper Functions ---

async function searchWeb(query) {
  const searchEndpoint = `https://${process.env.VERCEL_URL}/api/search`;
  debugLog(`Calling search service at ${searchEndpoint}`);
  try {
    const response = await axios.post(searchEndpoint, { query, max_results: 5 }, {
      timeout: 45000, // Generous timeout for the crawler service
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}` }
    });
    if (response.data && response.data.results && response.data.results.length > 0) {
      let searchResultsText = `Search results for "${query}":\n\n`;
      response.data.results.forEach((r, i) => {
        searchResultsText += `${i + 1}. ${r.title}\n   Source: ${r.url}\n   ${r.content}\n\n`;
      });
      return searchResultsText;
    }
    return 'No search results found.';
  } catch (error) {
    debugLog(`Error in searchWeb: ${error.message}`);
    return 'Web search failed.';
  }
}

async function runOpenAIFactCheck(query, searchResults) {
  const systemPrompt = `You are a political fact-checking assistant. Your task is to verify the following political claim. Provide a verdict (True, Mostly True, Mixed, Mostly False, False, or Unverifiable), a detailed explanation, and your confidence level (High, Medium, or Low).

Format your response exactly as follows:

Verdict: [Your verdict]

Explanation: [Your detailed explanation]

Sources: [List your sources if available, or state "Based on general knowledge"]

Confidence: [High/Medium/Low]`;

  const userPrompt = `Fact check this claim: "${query}"\n\nHere are some search results to help you:\n\n${searchResults}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    temperature: 0.7,
    max_tokens: 500
  });
  return completion.choices[0].message.content;
}

async function storeResultInCache(query, result) {
    try {
        await supabase.from('fact_checks').insert([{ query, result }]);
        debugLog('Result stored in permanent cache.');
    } catch(error) {
        debugLog(`Failed to store result in cache: ${error.message}`);
    }
}

// --- Main Worker Handler ---

module.exports = async (req, res) => {
  debugLog('Worker invoked.');
  debugLog(`Supabase URL loaded: ${!!process.env.SUPABASE_URL}`);
  debugLog(`Supabase Key loaded: ${!!process.env.SUPABASE_KEY}`);
  debugLog(`OpenAI Key loaded: ${!!process.env.OPENAI_API_KEY}`);

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { jobId } = req.body;
  if (!jobId) {
    debugLog('Request rejected: jobId is missing.');
    return res.status(400).json({ error: 'jobId is required' });
  }
  debugLog(`Received job ID: ${jobId}`);

  // Acknowledge the request immediately to prevent the client from waiting
  res.status(202).end();
  debugLog('Response sent to caller. Starting background processing.');

  let jobQuery;
  try {
    // 1. Break down the job update and fetch into two steps for robust logging
    debugLog(`Step 1a: Updating job ${jobId} status to 'processing'.`);
    const { error: updateError } = await supabase
      .from('fact_check_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId)
      .select('id'); // Force the query to wait for a response

    if (updateError) {
      debugLog(`Error during status update: ${updateError.message}`);
      throw new Error(`Could not update status for job ${jobId}.`);
    }
    debugLog(`Step 1b: Status updated. Fetching query for job ${jobId}.`);

    const { data: job, error: fetchError } = await supabase
      .from('fact_check_jobs')
      .select('query')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      debugLog(`Error fetching job after update: ${fetchError?.message}`);
      throw new Error(`Could not fetch job details for ${jobId} after update.`);
    }

    jobQuery = job.query;
    debugLog(`Successfully fetched job ${jobId}. Query: ${jobQuery.substring(0, 50)}...`);

    // 2. Perform the long-running tasks
    debugLog('Step 2: Performing long-running tasks.');
    const searchResults = await searchWeb(jobQuery);
    const factCheckResult = await runOpenAIFactCheck(jobQuery, searchResults);

    // 3. Update job with the final result
    debugLog('Step 3: Updating job with final result.');
    await supabase.from('fact_check_jobs').update({ result: factCheckResult, status: 'completed' }).eq('id', jobId);
    debugLog(`Job ${jobId} completed successfully.`);

    // 4. Store the result in the permanent cache for future requests
    debugLog('Step 4: Storing result in cache.');
    await storeResultInCache(jobQuery, factCheckResult);

  } catch (error) {
    debugLog(`Worker failed for job ${jobId}: ${error.message}`);
    if (error.stack) {
      debugLog(error.stack);
    }
    await supabase.from('fact_check_jobs').update({ status: 'failed', error_message: error.message }).eq('id', jobId);
  }
};

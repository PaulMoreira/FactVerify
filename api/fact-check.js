// api/fact-check.js: Initiates a fact-checking job.
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

// Initialize Supabase client
let supabase;
try {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
} catch (error) {
  console.error('Failed to initialize Supabase client:', error.message);
  supabase = null;
}

// Helper to check for a pre-existing fact-check in the cache table
async function getExistingFactCheck(query) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('result')
      .eq('query', query)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') console.error('Cache check error:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Cache check exception:', e.message);
    return null;
  }
}

module.exports = async (req, res) => {
  // Standard CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection is not configured.' });
  }

  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    // 1. Check for a cached result first for a fast response
    const cachedResult = await getExistingFactCheck(query);
    if (cachedResult && cachedResult.result) {
      debugLog(`Returning cached result for query: ${query.substring(0, 30)}...`);
      return res.status(200).json({ result: cachedResult.result, source: 'cache' });
    }

    // 2. If not cached, create a new job
    debugLog(`Creating new job for query: ${query.substring(0, 30)}...`);
    const { data: job, error: insertError } = await supabase
      .from('fact_check_jobs')
      .insert([{ query: query }])
      .select('id')
      .single();

    if (insertError || !job) {
      console.error('Failed to create job:', insertError?.message);
      return res.status(500).json({ error: 'Could not start the fact-checking process.' });
    }

    const { id: jobId } = job;

    // 3. Trigger the worker asynchronously (fire-and-forget)
    const workerUrl = `https://${req.headers.host}/api/worker`;
    debugLog(`Triggering worker for job ${jobId} at ${workerUrl}`);
    axios.post(workerUrl, { jobId }, { timeout: 2000 }).catch(err => {
      // This error is non-blocking. Log it for monitoring.
      console.error(`Error triggering worker for job ${jobId}. This may require manual intervention. Message: ${err.message}`);
    });

    // 4. Immediately return the job ID to the client for polling
    debugLog(`Successfully created and triggered job ${jobId}`);
    res.status(202).json({ jobId });

  } catch (e) {
    console.error('Catastrophic error in /api/fact-check:', e.message);
    res.status(500).json({ error: 'An unexpected internal server error occurred.' });
  }
};

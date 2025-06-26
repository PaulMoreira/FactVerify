// api/status.js: Checks the status of a fact-checking job.
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log('[STATUS]', ...args);
}

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = async (req, res) => {
  // Standard CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId query parameter is required' });
  }

  try {
    debugLog(`Fetching status for job ID: ${jobId}`);
    const { data, error } = await supabase
      .from('fact_check_jobs')
      .select('status, result, error_message')
      .eq('id', jobId)
      .single();

    if (error) {
      // This can happen if the job ID is invalid or not found
      if (error.code === 'PGRST116') {
        debugLog(`Job not found for ID: ${jobId}`);
        return res.status(404).json({ status: 'not_found', error: 'Job not found.' });
      }
      throw error; // Rethrow other unexpected database errors
    }

    debugLog(`Status for job ${jobId} is ${data.status}`);
    res.status(200).json(data);

  } catch (e) {
    console.error(`Catastrophic error in status endpoint for job ${jobId}:`, e.message);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
};

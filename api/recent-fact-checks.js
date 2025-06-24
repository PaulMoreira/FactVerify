// Serverless function for recent-fact-checks endpoint
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://czlnbfqkvxyhyhpmdlmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Attempting to fetch recent fact checks from Supabase');
    console.log('Using Supabase URL:', supabaseUrl);
    console.log('Supabase key available:', !!supabaseKey);
    
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Supabase returned an error:', error);
      throw error;
    }
    
    console.log('Successfully fetched fact checks:', data ? data.length : 0);
    res.json({ factChecks: data || [] });
  } catch (error) {
    console.error('Error fetching recent fact checks:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'An error occurred while fetching recent fact checks: ' + error.message });
  }
}

// api/get-fact-check.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Fact-check ID is required.' });
  }

  try {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching fact-check:', error);
      if (error.code === 'PGRST116') { // "The result contains 0 rows"
        return res.status(404).json({ error: 'Fact-check not found.' });
      }
      return res.status(500).json({ error: 'Failed to fetch fact-check.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Fact-check not found.' });
    }

    // Add caching headers
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

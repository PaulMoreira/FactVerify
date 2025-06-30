// api/sitemap.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://czlnbfqkvxyhyhpmdlmo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// This function will generate the sitemap XML.
const generateSitemap = async () => {
  const baseUrl = 'https://factverify.app';
  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add the homepage URL.
  xml += `
    <url>
      <loc>${baseUrl}/</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
    <url>
      <loc>${baseUrl}/fact-check/recent</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>
  `;

  try {
    // Fetch all fact check IDs from the database
    const { data, error } = await supabase
      .from('fact_checks')
      .select('id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fact checks:', error);
    } else if (data && data.length > 0) {
      console.log(`Adding ${data.length} fact check URLs to sitemap`);
      
      // Add each fact check URL to the sitemap
      data.forEach(factCheck => {
        const lastmod = factCheck.created_at 
          ? new Date(factCheck.created_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        xml += `
    <url>
      <loc>${baseUrl}/fact-check/${factCheck.id}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>never</changefreq>
      <priority>0.7</priority>
    </url>`;
      });
    }
  } catch (dbError) {
    console.error('Database error while generating sitemap:', dbError);
  }

  xml += `
</urlset>`;
  return xml;
};

// The main serverless function handler.
module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Generate the sitemap dynamically
    const sitemap = await generateSitemap();

    // Set the content-type to XML and send the sitemap
    res.setHeader('Content-Type', 'application/xml');
    // Add caching headers to reduce server load (4 hours instead of 24 to ensure fresher content)
    res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Failed to generate sitemap.' });
  }
};

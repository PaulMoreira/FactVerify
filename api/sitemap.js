// api/sitemap.js
const { createClient } = require('@supabase/supabase-js');

// This function will generate the sitemap XML.
const generateSitemap = () => {
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
  `;

  // In the future, you could fetch dynamic URLs from your database and add them here.
  // For example, if each fact-check had its own page like /fact-check/[id]

  xml += `</urlset>`;
  return xml;
};

// The main serverless function handler.
module.exports = async (req, res) => {
  try {
    const sitemap = generateSitemap();

    // Set the content-type to XML and send the sitemap.
    res.setHeader('Content-Type', 'application/xml');
    // Add caching headers to reduce server load.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Cache for 24 hours
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Failed to generate sitemap.' });
  }
};

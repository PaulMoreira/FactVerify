// Utility to generate embeddings for text using OpenAI API
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate an embedding vector for a text string
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<Array<number>>} - The embedding vector
 */
async function generateEmbedding(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.trim(),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Find similar claims in the database based on semantic similarity
 * @param {object} supabase - Initialized Supabase client
 * @param {string} query - The claim text to find similar claims for
 * @param {number} similarityThreshold - Threshold for similarity (0.0 to 1.0)
 * @param {number} maxResults - Maximum number of similar claims to return
 * @returns {Promise<Array<{query: string, similarity: number}>>} - Array of similar claims
 */
async function findSimilarClaims(supabase, query, similarityThreshold = 0.8, maxResults = 5) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Call the database function to find similar claims
    const { data, error } = await supabase.rpc('find_similar_claims', {
      search_query: query,
      search_embedding: embedding,
      similarity_threshold: similarityThreshold,
      max_results: maxResults
    });
    
    if (error) {
      console.error('Error finding similar claims:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in findSimilarClaims:', error);
    return [];
  }
}

/**
 * Store a claim embedding in the database
 * @param {object} supabase - Initialized Supabase client
 * @param {string} query - The claim text
 * @returns {Promise<object>} - The stored embedding record
 */
async function storeClaimEmbedding(supabase, query) {
  try {
    // Check if this claim already has an embedding
    const { data: existingEmbedding } = await supabase
      .from('claim_embeddings')
      .select('id')
      .eq('query', query)
      .maybeSingle();
    
    if (existingEmbedding) {
      console.log(`Embedding for "${query}" already exists`);
      return existingEmbedding;
    }
    
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Store the embedding
    const { data, error } = await supabase
      .from('claim_embeddings')
      .insert([{
        query,
        embedding
      }])
      .select();
    
    if (error) {
      console.error('Error storing claim embedding:', error);
      throw error;
    }
    
    console.log(`Stored embedding for "${query}"`);
    return data[0];
  } catch (error) {
    console.error('Error in storeClaimEmbedding:', error);
    throw error;
  }
}

/**
 * Find or create the most representative claim for a group of similar claims
 * @param {object} supabase - Initialized Supabase client
 * @param {string} query - The claim text
 * @param {number} similarityThreshold - Threshold for similarity (0.0 to 1.0)
 * @returns {Promise<string>} - The representative claim text
 */
async function findOrCreateRepresentativeClaim(supabase, query, similarityThreshold = 0.8) {
  try {
    // Find similar claims
    const similarClaims = await findSimilarClaims(supabase, query, similarityThreshold, 10);
    
    if (similarClaims.length === 0) {
      // No similar claims found, store this as a new claim embedding
      await storeClaimEmbedding(supabase, query);
      return query;
    }
    
    // Find the claim with the most occurrences in the database
    // First check search_counts
    const queries = [query, ...similarClaims.map(c => c.query)];
    
    const { data: searchCounts, error: searchError } = await supabase
      .from('search_counts')
      .select('query, count')
      .in('query', queries)
      .order('count', { ascending: false });
    
    if (searchError) {
      console.error('Error fetching search counts:', searchError);
    }
    
    // Then check misinformation_counts
    const { data: misinformationCounts, error: misinfoError } = await supabase
      .from('misinformation_counts')
      .select('query, count')
      .in('query', queries)
      .order('count', { ascending: false });
    
    if (misinfoError) {
      console.error('Error fetching misinformation counts:', misinfoError);
    }
    
    // Combine the counts to find the most frequent claim
    const combinedCounts = new Map();
    
    // Add search counts
    if (searchCounts && searchCounts.length > 0) {
      searchCounts.forEach(item => {
        combinedCounts.set(item.query, (combinedCounts.get(item.query) || 0) + item.count);
      });
    }
    
    // Add misinformation counts
    if (misinformationCounts && misinformationCounts.length > 0) {
      misinformationCounts.forEach(item => {
        combinedCounts.set(item.query, (combinedCounts.get(item.query) || 0) + item.count);
      });
    }
    
    // If no counts found, default to the most similar claim
    if (combinedCounts.size === 0) {
      const representativeClaim = similarClaims[0]?.query || query;
      return representativeClaim;
    }
    
    // Find the claim with the highest count
    let maxCount = 0;
    let representativeClaim = query;
    
    combinedCounts.forEach((count, claimQuery) => {
      if (count > maxCount) {
        maxCount = count;
        representativeClaim = claimQuery;
      }
    });
    
    return representativeClaim;
  } catch (error) {
    console.error('Error in findOrCreateRepresentativeClaim:', error);
    return query; // Fall back to the original query
  }
}

module.exports = {
  generateEmbedding,
  findSimilarClaims,
  storeClaimEmbedding,
  findOrCreateRepresentativeClaim
};

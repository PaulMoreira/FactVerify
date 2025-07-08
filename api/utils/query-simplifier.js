/**
 * Utility functions for simplifying search queries to improve search results
 */

/**
 * Simplifies a complex query by extracting key entities and terms
 * @param {string} query - The original search query
 * @returns {string} A simplified version of the query with key terms
 */
function simplifyQuery(query) {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // Remove quotes and special characters
  let cleaned = query.replace(/["'"]/g, ' ').replace(/[^\w\s]/g, ' ');
  
  // Extract potential named entities (capitalized words)
  const namedEntities = extractNamedEntities(cleaned);
  
  // Extract key nouns and verbs
  const keyTerms = extractKeyTerms(cleaned);
  
  // Combine named entities and key terms, prioritizing named entities
  const combinedTerms = [...new Set([...namedEntities, ...keyTerms])];
  
  // Limit to a reasonable number of terms (too many terms can reduce search effectiveness)
  const limitedTerms = combinedTerms.slice(0, 6);
  
  return limitedTerms.join(' ');
}

/**
 * Extracts potential named entities (people, organizations, etc.) from text
 * @param {string} text - The text to analyze
 * @returns {string[]} Array of potential named entities
 */
function extractNamedEntities(text) {
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter(word => 
    word.length > 1 && 
    word[0] === word[0].toUpperCase() && 
    word[0] !== word[0].toLowerCase()
  );
  
  // Group consecutive capitalized words as they likely form a single entity
  const entities = [];
  let currentEntity = [];
  
  capitalizedWords.forEach(word => {
    if (currentEntity.length === 0 || 
        words.indexOf(currentEntity[currentEntity.length - 1]) + 1 === words.indexOf(word)) {
      currentEntity.push(word);
    } else {
      if (currentEntity.length > 0) {
        entities.push(currentEntity.join(' '));
        currentEntity = [word];
      }
    }
  });
  
  if (currentEntity.length > 0) {
    entities.push(currentEntity.join(' '));
  }
  
  return entities;
}

/**
 * Extracts key terms (important nouns and verbs) from text
 * @param {string} text - The text to analyze
 * @returns {string[]} Array of key terms
 */
function extractKeyTerms(text) {
  const words = text.toLowerCase().split(/\s+/);
  
  // Filter out common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 
    'when', 'where', 'how', 'that', 'this', 'these', 'those', 'is', 'are', 
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 
    'did', 'to', 'at', 'in', 'on', 'for', 'with', 'about', 'by', 'of'
  ]);
  
  const filteredWords = words.filter(word => 
    word.length > 2 && !stopWords.has(word)
  );
  
  // Return unique terms
  return [...new Set(filteredWords)];
}

module.exports = {
  simplifyQuery
};

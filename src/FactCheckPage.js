import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FactCheck.css';
import LoadingAnimation from './LoadingAnimation';
import ShareResults from './ShareResults';

const FactCheckPage = () => {
  const [claim, setClaim] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentFactChecks, setRecentFactChecks] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [searchEngine, setSearchEngine] = useState(null);

  // API base URL - use environment variable or default to production URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://factverify.vercel.app';

  // Fetch recent fact checks on component mount
  useEffect(() => {
    const fetchRecentFactChecks = async () => {
      try {
        // Ensure no double slashes in URL
        const url = `${API_BASE_URL.replace(/\/$/, '')}/api/recent-fact-checks`;
        const response = await axios.get(url);
        if (response.data && response.data.factChecks) {
          setRecentFactChecks(response.data.factChecks);
        }
      } catch (err) {
        console.error('Error fetching recent fact checks:', err);
      }
    };

    fetchRecentFactChecks();
  }, [API_BASE_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      // Call our backend API for fact-checking
      // Ensure no double slashes in URL
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/fact-check`;
      const response = await axios.post(url, { query: claim });
      
      if (response.data && response.data.result) {
        // Parse the result to extract verdict, explanation, sources, etc.
        const factCheckResult = parseFactCheckResult(response.data.result, claim);
        setResult(factCheckResult);
        
        // Set search engine information if available
        if (response.data.searchEngine) {
          setSearchEngine(response.data.searchEngine);
          console.log(`Search powered by: ${response.data.searchEngine}`);
        }
        
        // Refresh recent fact checks after a new check
        // Ensure no double slashes in URL
        const recentUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/recent-fact-checks`;
        const recentResponse = await axios.get(recentUrl);
        if (recentResponse.data && recentResponse.data.factChecks) {
          setRecentFactChecks(recentResponse.data.factChecks);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error during fact check:', err);
      setError('Error checking the claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to parse the fact check result from OpenAI
  const parseFactCheckResult = (resultText, originalClaim) => {
    // Default values
    let verdict = 'Unverified';
    let explanation = resultText;
    let sources = ['No specific sources cited'];
    let confidence = 'Medium';
    
    try {
      // Check if the result is already in a structured format with sections
      if (typeof resultText === 'string') {
        // Look for "Verdict:" section
        const verdictMatch = resultText.match(/Verdict:\s*([^\n\r]+)/i);
        if (verdictMatch && verdictMatch[1]) {
          verdict = verdictMatch[1].trim();
        }
        
        // Look for "Explanation:" section - capture everything until the next section
        const explanationMatch = resultText.match(/Explanation:\s*([\s\S]*?)(?=(Sources:|Confidence:|$))/i);
        if (explanationMatch && explanationMatch[1]) {
          explanation = explanationMatch[1].trim();
        }
        
        // Look for "Sources:" section
        const sourcesSection = resultText.match(/Sources:\s*([\s\S]*?)(?=(Confidence:|$))/i);
        if (sourcesSection && sourcesSection[1]) {
          // Extract URLs or bullet points
          const urlRegex = /(https?:\/\/[^\s\)\]"']+)/g;
          const foundUrls = sourcesSection[1].match(urlRegex);
          
          if (foundUrls && foundUrls.length > 0) {
            // Limit to 3 sources and clean up URLs
            sources = foundUrls.slice(0, 3).map(url => {
              // Remove trailing punctuation or special characters that might break URLs
              return url.replace(/[.,;:!?)\]]+$/, '');
            });
          } else {
            // Look for bullet points or numbered lists
            const bulletPoints = sourcesSection[1]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
              .map(line => line.replace(/^[-*\d\.\s]+/, '').trim());
              
            if (bulletPoints.length > 0) {
              // Limit to 3 sources
              sources = bulletPoints.slice(0, 3);
            } else if (sourcesSection[1].trim() !== '') {
              sources = [sourcesSection[1].trim()];
            }
          }
        }
        
        // Look for "Confidence:" section
        const confidenceMatch = resultText.match(/Confidence:\s*([^\n\r]+)/i);
        if (confidenceMatch && confidenceMatch[1]) {
          const confidenceText = confidenceMatch[1].trim().toLowerCase();
          if (confidenceText.includes('high')) {
            confidence = 'High';
          } else if (confidenceText.includes('low')) {
            confidence = 'Low';
          } else {
            confidence = 'Medium';
          }
        }
      }
      
      // Fallback to simple keyword matching if structured parsing fails
      if (verdict === 'Unverified') {
        if (resultText.toLowerCase().includes('true') && 
            !resultText.toLowerCase().includes('false') && 
            !resultText.toLowerCase().includes('mostly false')) {
          verdict = 'True';
        } else if (resultText.toLowerCase().includes('false') && 
                  !resultText.toLowerCase().includes('mostly true')) {
          verdict = 'False';
        } else if (resultText.toLowerCase().includes('partially true') || 
                  resultText.toLowerCase().includes('partly true') || 
                  resultText.toLowerCase().includes('mixed') ||
                  resultText.toLowerCase().includes('mostly true')) {
          verdict = 'Partially True';
        }
      }
    } catch (error) {
      console.error('Error parsing fact check result:', error);
      // Keep the defaults if parsing fails
    }
    
    return {
      verdict,
      explanation,
      sources,
      confidence
    };
  };
  
  // Function to load a previous fact check
  const loadFactCheck = (factCheck) => {
    setClaim(factCheck.query);
    setResult(parseFactCheckResult(factCheck.result, factCheck.query));
    
    // Check if the result contains search engine information
    if (factCheck.result.includes('[Search powered by:')) {
      const engineMatch = factCheck.result.match(/\[Search powered by:\s*([^\]]+)\]/i);
      if (engineMatch && engineMatch[1]) {
        setSearchEngine(engineMatch[1].trim());
      }
    } else {
      setSearchEngine(null);
    }
  };

  return (
    <div className="fact-check-container">
      <a href="#fact-check-form" className="skip-to-content">Skip to fact check form</a>
      <h2>AI Fact-Checking Portal</h2>
      <p>Enter a political claim, headline, or statement below. Our AI will research and check its accuracy using Crawl4AI search and AI agent capabilities.</p>
      
      <form onSubmit={handleSubmit} className="fact-check-form" id="fact-check-form">
        <textarea 
          value={claim} 
          onChange={e => setClaim(e.target.value)} 
          placeholder="Enter a political claim to fact-check..."
          rows="4"
          required
          aria-label="Political claim to fact-check"
        />
        <button 
          type="submit" 
          disabled={loading || !claim.trim()}
          aria-busy={loading}
        >
          {loading ? 'Checking...' : 'Fact Check'}
        </button>
      </form>
      
      {error && <div className="error" role="alert">{error}</div>}
      {loading && <LoadingAnimation />}
      
      {result && (
        <div className="fact-check-result" role="region" aria-label="Fact check result">
          {searchEngine && (
            <div className="search-engine-info">
              <span className={`search-engine-badge ${searchEngine.toLowerCase()}`}>Powered by {searchEngine}</span>
            </div>
          )}
          <h3 className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
          <div className="result-explanation">
            {result.explanation.split('\n').map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
          </div>
          
          <div className="result-sources">
            <strong>Sources:</strong>
            <ul>
              {result.sources.slice(0, 3).map((src, idx) => (
                <li key={idx}>
                  {src.match(/^https?:\/\//i) ? (
                    <a 
                      href={src.trim()} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      aria-label={`Source ${idx + 1}`}
                      className="source-link"
                    >
                      {`Source ${idx + 1}: ${src.trim().replace(/^https?:\/\/(?:www\.)?([^\/]+).*$/, '$1')}`}
                    </a>
                  ) : (
                    <span>{src}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="confidence-meter">
            <strong>Confidence:</strong> <span className={`confidence-${result.confidence.toLowerCase()}`}>{result.confidence}</span>
          </div>
          
          <ShareResults result={result} claim={claim} />
        </div>
      )}
      
      {/* Recent Fact Checks Section */}
      <div className="recent-fact-checks">
        <button 
          className="toggle-recent" 
          onClick={() => setShowRecent(!showRecent)}
          aria-expanded={showRecent}
          aria-controls="recent-checks-list"
        >
          {showRecent ? 'Hide Recent Fact Checks' : 'Show Recent Fact Checks'}
        </button>
        
        {showRecent && (
          <div id="recent-checks-list" className="recent-checks-list">
            <h3>Recent Fact Checks</h3>
            {recentFactChecks.length > 0 ? (
              <ul>
                {recentFactChecks.map((check) => (
                  <li key={check.id} className="recent-check-item">
                    <button 
                      onClick={() => loadFactCheck(check)}
                      className="load-fact-check"
                      aria-label={`Load fact check: ${check.query}`}
                    >
                      {check.query.length > 100 ? `${check.query.substring(0, 100)}...` : check.query}
                    </button>
                    <span className="check-date">
                      {new Date(check.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent fact checks available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FactCheckPage;

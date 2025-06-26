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

  // API base URL - use relative URLs when deployed to the same domain
  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  // Fetch recent fact checks on component mount
  useEffect(() => {
    const fetchRecentFactChecks = async () => {
      try {
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
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/fact-check`;
      const response = await axios.post(url, { query: claim });
      
      // The backend now sends a clean JSON object directly.
      if (response.data && response.data.verdict) {
        setResult(response.data);
        
        // Refresh recent fact checks after a new check
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
  
  // Function to load a previous fact check from the history
  const loadFactCheck = (factCheck) => {
    setClaim(factCheck.query);
    try {
      // The result from the DB is a stringified JSON object, so we parse it.
      const parsedResult = JSON.parse(factCheck.result);
      setResult(parsedResult);
    } catch (err) {
      console.error('Failed to parse stored fact check result:', err);
      // If parsing fails, create a fallback error display
      setResult({
        verdict: 'Error',
        summary: 'Could not load this fact check. The stored data may be corrupted.',
        sources: [],
        confidence: 'Low'
      });
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
          <h3 className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
          <div className="result-explanation">
            {/* We now use the 'summary' field from our JSON object */}
            {result.summary.split('\n').map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
          </div>
          
          {/* Render sources only if they exist and the array is not empty */}
          {result.sources && result.sources.length > 0 && (
            <div className="result-sources">
              <strong>Sources:</strong>
              <ul>
                {/* Map over the sources array to create clickable links */}
                {result.sources.map((src, idx) => (
                  <li key={idx}>
                    <a 
                      href={src.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      aria-label={`Source: ${src.title}`}
                      className="source-link"
                    >
                      {src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
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
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

  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

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
      
      if (response.data && response.data.verdict) {
        setResult(response.data);
        
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
  
  const loadFactCheck = (factCheck) => {
    setClaim(factCheck.query);
    try {
      const parsedResult = JSON.parse(factCheck.result);
      setResult(parsedResult);
    } catch (err) {
      console.error('Failed to parse stored fact check result:', err);
      setResult({
        verdict: 'Error',
        summary: 'Could not load this fact check. The stored data may be corrupted.',
        sources: [],
        confidence: 'Low'
      });
    }
  };

  return (
    <main className="fact-check-container">
      <a href="#fact-check-form" className="skip-to-content">Skip to fact check form</a>
      
      <section id="fact-check-form-section" aria-labelledby="form-heading">
        <h2 id="form-heading" className="visually-hidden">AI Fact-Checking Form</h2>
        <p className="form-description">
          Enter a political claim, headline, or statement below. Our AI will research and check its accuracy using real-time web search and AI agent capabilities.
        </p>
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
      </section>
      
      {loading && <LoadingAnimation />}
      {error && <div className="error" role="alert">{error}</div>}
      
      {result && (
        <section className="fact-check-result" aria-live="polite" aria-labelledby="result-heading">
          <h3 id="result-heading" className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
          <div className="result-explanation">
            {result.summary.split('\n').map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
          </div>
          
          {result.detailed_analysis && (
            <div className="result-detailed-analysis">
              <h4>Detailed Analysis</h4>
              {result.detailed_analysis.split('\n').map((paragraph, idx) => (
                paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
              ))}
            </div>
          )}
          
          {result.sources && result.sources.length > 0 && (
            <div className="result-sources">
              <strong>Sources:</strong>
              <ul>
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
        </section>
      )}
      
      <section className="recent-fact-checks">
        <button 
          className="toggle-recent" 
          onClick={() => setShowRecent(!showRecent)}
          aria-expanded={showRecent}
          aria-controls="recent-checks-list"
        >
          {showRecent ? 'Hide Recent Checks' : 'Show Recent Checks'}
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
      </section>
    </main>
  );
};

export default FactCheckPage;
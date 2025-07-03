import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './FactCheck.css';
import LoadingAnimation from './LoadingAnimation';
import ShareResults from './ShareResults';

const initialClaim = '';

const FactCheckPage = () => {
  const [claim, setClaim] = useState(initialClaim);
  const [displayedClaim, setDisplayedClaim] = useState(initialClaim);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newFactCheckId, setNewFactCheckId] = useState(null);
  const [recentFactChecks, setRecentFactChecks] = useState([]);

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
    setDisplayedClaim(claim);
    
    try {
      const url = `${API_BASE_URL.replace(/\/$/, '')}/api/fact-check`;
      const response = await axios.post(url, { query: claim });
      
      if (response.data && response.data.verdict) {
        setResult(response.data);
        if (response.data.id) {
          setNewFactCheckId(response.data.id);
        }
        
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
      setClaim('');
    }
  };
  
  const loadFactCheck = (factCheck) => {
    setDisplayedClaim(factCheck.query);
    try {
      const parsedResult = JSON.parse(factCheck.result);
      setResult(parsedResult);
      setNewFactCheckId(factCheck.id);
      setClaim('');
      setError('');
    } catch (err) {
      console.error('Failed to parse stored fact check result:', err);
      setError('Could not load this fact check. The stored data may be corrupted.');
      setResult(null);
      setDisplayedClaim('');
    }
  };

  const generateStructuredData = () => {
    if (!result || !displayedClaim) return null;

    const ratingMap = {
      'true': 5,
      'mostly true': 4,
      'mixture': 3,
      'mostly false': 2,
      'false': 1,
      'misleading': 2.5,
    };

    const verdictText = result.verdict?.toLowerCase().replace(/\s+/g, ' ') || '';
    const numericRating = ratingMap[verdictText];

    const claimReview = {
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      "datePublished": new Date().toISOString(),
      "claimReviewed": displayedClaim,
      "author": {
        "@type": "Organization",
        "name": "FactVerify",
        "url": "https://factverify.app"
      }
    };

    if (numericRating) {
      claimReview.reviewRating = {
        "@type": "Rating",
        "ratingValue": numericRating,
        "bestRating": 5,
        "worstRating": 1,
        "alternateName": result.verdict
      };
    } else {
        claimReview.reviewRating = {
            "@type": "Rating",
            "alternateName": result.verdict
        }
    }

    return claimReview;
  };

  const structuredData = generateStructuredData();

  return (
    <div className="page-container">
      <Helmet>
        <title>{result ? `Fact Check: ${displayedClaim.substring(0, 50)}...` : 'FactVerify | AI-Powered Political Fact-Checking'}</title>
        <meta name="description" content={result ? result.summary : 'Enter a political claim to get an instant, AI-powered fact-check. We use real-time data to verify statements and fight misinformation.'} />
        <meta property="og:title" content={result ? `Fact Check: ${displayedClaim}` : 'FactVerify'} />
        <meta property="og:description" content={result ? result.summary : 'AI-powered political fact-checking.'} />
        <meta property="og:url" content={newFactCheckId ? `https://factverify.app/fact-check/${newFactCheckId}` : 'https://factverify.app'} />
        <meta property="og:type" content="website" />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>
      <main className="main-content-container">
        <div className="form-wrapper">
          <section className="fact-check-form" data-testid="fact-check-form">
            <h2 className="visually-hidden">AI Fact-Checking Portal</h2>
            <div className="form-container">
              <p className="form-description">Enter any claim below and our AI will verify its accuracy using reliable sources.</p>
              <form onSubmit={handleSubmit}>
                <label htmlFor="claim-input" className="visually-hidden">Enter a claim to fact-check</label>
                <textarea id="claim-input" value={claim} onChange={e => setClaim(e.target.value)} placeholder="Enter a claim to fact-check..." rows="4" required aria-label="Claim to fact-check" />
                <button id="fact-check-submit" type="submit" disabled={loading || !claim.trim()} aria-busy={loading}>
                  {loading ? 'Checking...' : 'Fact Check'}
                </button>
              </form>
            </div>
          </section>
        </div>
        {loading && <div className="loading-wrapper"><LoadingAnimation /></div>}
        {error && <div className="error" role="alert">{error}</div>}
        {result && (
          <section className="fact-check-result" aria-live="polite" aria-labelledby="result-heading">
            <h2 className="claim-reviewed">Claim: "{displayedClaim}"</h2>
            <h3 id="result-heading" className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
            <div className="result-content-wrapper">
              <div className="result-explanation">
                {result.summary.split('\n').map((p, i) => (p.trim() ? <p key={i}>{p}</p> : null))}
              </div>
              {result.detailed_analysis && (
                <div className="result-detailed-analysis">
                  <h4>Detailed Analysis</h4>
                  {result.detailed_analysis.split('\n').map((p, i) => (p.trim() ? <p key={i}>{p}</p> : null))}
                </div>
              )}
              {result.sources && result.sources.length > 0 && (
                <div className="result-sources">
                  <h4>Sources:</h4>
                  <div className="source-cards-container">
                    {result.sources.map((src, i) => (
                      <div className="source-card" key={i}>
                        <div className="source-card-image">
                          <img 
                            src={src.image || `https://www.google.com/s2/favicons?domain=${new URL(src.url).hostname}&sz=128`} 
                            alt="" 
                            onError={(e) => {
                              e.target.onerror = null;
                              // Try a different favicon service if Google's fails
                              e.target.src = `https://icon.horse/icon/${new URL(src.url).hostname}`;
                              // If that also fails, use a domain-colored placeholder
                              e.target.onerror = () => {
                                const domain = new URL(src.url).hostname;
                                const colorHash = Math.abs(domain.split('').reduce((acc, char) => {
                                  return char.charCodeAt(0) + ((acc << 5) - acc);
                                }, 0));
                                const hue = colorHash % 360;
                                const letter = domain.charAt(0).toUpperCase();
                                e.target.style.display = 'none';
                                e.target.parentNode.style.backgroundColor = `hsl(${hue}, 70%, 60%)`;
                                e.target.parentNode.innerHTML = `<div class="source-card-fallback">${letter}</div>`;
                              };
                            }}
                          />
                        </div>
                        <div className="source-card-content">
                          <h5 className="source-card-title">
                            <a href={src.url} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${src.title}`}>
                              {src.title}
                            </a>
                          </h5>
                          <span className="source-card-domain">{new URL(src.url).hostname.replace('www.', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="confidence-meter">
                <strong>Confidence:</strong> <span className={`confidence-${result.confidence.toLowerCase()}`}>{result.confidence}</span>
              </div>
              <ShareResults result={result} claim={displayedClaim} url={newFactCheckId ? `https://factverify.app/fact-check/${newFactCheckId}` : ''} />
              {newFactCheckId && (
                <div className="permalink-container">
                  <Link to={`/fact-check/${newFactCheckId}`} className="permalink">View or share this fact-check</Link>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <aside className="sidebar-container">
        <section className="recent-fact-checks">
          <h3>Recent Fact Checks</h3>
          {recentFactChecks.length > 0 ? (
            <ul className="recent-checks-list">
              {recentFactChecks.map(check => {
                let verdict = 'unknown';
                try {
                  const parsedResult = JSON.parse(check.result);
                  verdict = parsedResult.verdict.toLowerCase().replace(/\s+/g, '-');
                } catch (err) {
                  console.error('Failed to parse verdict for recent fact check:', err);
                }
                
                return (
                  <li key={check.id} className="recent-check-item">
                    <button onClick={() => loadFactCheck(check)} className="load-fact-check" aria-label={`Load fact check: ${check.query}`}>
                      <div className="recent-check-header">
                        <span className={`fact-check-verdict verdict-${verdict}`}>{verdict.replace(/-/g, ' ')}</span>
                        <span className="check-date">{new Date(check.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className="recent-check-query">{check.query}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (<p>No recent fact checks available.</p>)}
        </section>
      </aside>
    </div>
  );
};

export default FactCheckPage;
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './FactCheck.css';
import LoadingAnimation from './LoadingAnimation';
import ShareResults from './ShareResults';
import TopSearchedList from './TopSearchedList';
import TopMisinformationList from './TopMisinformationList';
import './SourceCitation.css';
import './SidebarStyles.css';
import Carousel from './Carousel';

const initialClaim = '';

// Function to format source citations as superscripts with tooltips
const formatSourceCitations = (text, sources) => {
  if (!text || !sources) return text;
  
  // Replace SOURCE_X patterns with superscript citation HTML
  const formattedText = text.replace(/\(SOURCE_(\d+)(,\s*SOURCE_(\d+))*\)/g, (match, ...args) => {
    // Extract all source numbers from the match
    const sourceNumbers = [];
    const matches = match.match(/\d+/g);
    if (matches) {
      matches.forEach(num => sourceNumbers.push(num));
    }
    
    // Create HTML for each source citation
    const citationsHtml = sourceNumbers.map(num => {
      const sourceIndex = parseInt(num) - 1;
      const source = sources[sourceIndex];
      if (!source) return '';
      
      const domain = source.url ? new URL(source.url).hostname.replace('www.', '') : '';
      
      return `<span class="source-citation" 
                   tabindex="0" 
                   role="button"
                   data-citation-id="${num}"
                   aria-label="Source ${num}: ${source.title || 'Citation'}">
                ${num}
                <span class="source-tooltip" role="tooltip">
                  ${source.title || `Source ${num}`}
                  ${domain ? `<span style="display: block; font-size: 0.8em; color: #718096;">${domain}</span>` : ''}
                </span>
              </span>`;
    }).join('');
    
    return citationsHtml;
  });
  
  return formattedText;
};

const FactCheckPage = () => {
  const resultRef = useRef(null);
  
  // Add event listeners for mobile tooltip interactions and tooltip positioning
  useEffect(() => {
    // Function to position tooltips within viewport
    const positionTooltips = () => {
      document.querySelectorAll('.source-citation').forEach(citation => {
        const tooltip = citation.querySelector('.source-tooltip');
        if (!tooltip) return;
        
        // Reset position to default
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%) translateY(-2px)';
        tooltip.style.bottom = '100%';
        tooltip.style.top = 'auto';
        
        // Get tooltip and citation positions
        const tooltipRect = tooltip.getBoundingClientRect();
        const citationRect = citation.getBoundingClientRect();
        
        // Check if tooltip goes off the right edge
        if (tooltipRect.right > window.innerWidth) {
          tooltip.style.left = 'auto';
          tooltip.style.right = '0';
          tooltip.style.transform = 'translateY(-2px)';
        }
        
        // Check if tooltip goes off the left edge
        if (tooltipRect.left < 0) {
          tooltip.style.left = '0';
          tooltip.style.transform = 'translateY(-2px)';
        }
        
        // Check if tooltip goes off the top
        if (tooltipRect.top < 0 || citationRect.top < tooltipRect.height + 10) {
          tooltip.style.bottom = 'auto';
          tooltip.style.top = '100%';
          tooltip.style.transform = tooltip.style.transform.replace('translateY(-2px)', 'translateY(2px)');
        }
      });
    };
    
    const handleCitationClick = (e) => {
      // Check if the clicked element is a source citation
      if (e.target.closest('.source-citation')) {
        const citation = e.target.closest('.source-citation');
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
          e.preventDefault();
          
          // Remove active class from all citations
          document.querySelectorAll('.source-citation.active').forEach(el => {
            if (el !== citation) el.classList.remove('active');
          });
          
          // Toggle active class on clicked citation
          citation.classList.toggle('active');
          
          // Position tooltip if active
          if (citation.classList.contains('active')) {
            setTimeout(positionTooltips, 0); // Run after render
          }
          
          // Create or remove backdrop
          let backdrop = document.querySelector('.tooltip-backdrop');
          if (citation.classList.contains('active')) {
            if (!backdrop) {
              backdrop = document.createElement('div');
              backdrop.className = 'tooltip-backdrop';
              document.body.appendChild(backdrop);
              
              // Add click handler to backdrop
              backdrop.addEventListener('click', () => {
                document.querySelectorAll('.source-citation.active').forEach(el => {
                  el.classList.remove('active');
                });
                backdrop.remove();
              });
            }
            backdrop.classList.add('active');
          } else if (backdrop) {
            backdrop.remove();
          }
        } else {
          // For desktop, just make sure tooltip is positioned correctly
          setTimeout(positionTooltips, 0); // Run after render
        }
      } else if (!e.target.closest('.source-tooltip')) {
        // If clicking outside a citation or tooltip, close all tooltips
        document.querySelectorAll('.source-citation.active').forEach(el => {
          el.classList.remove('active');
        });
        
        const backdrop = document.querySelector('.tooltip-backdrop');
        if (backdrop) backdrop.remove();
      }
    };
    
    // Handler for mouse enter/hover on citations
    const handleCitationHover = (e) => {
      if (e.target.closest('.source-citation')) {
        setTimeout(positionTooltips, 0); // Run after render
      }
    };
    
    // Store the current ref value in a variable to use in cleanup
    const currentRef = resultRef.current;
    
    // Add event listeners to the result container when it exists
    if (currentRef) {
      currentRef.addEventListener('click', handleCitationClick);
      currentRef.addEventListener('mouseenter', handleCitationHover, true);
      
      // Also run positioning on window resize
      window.addEventListener('resize', positionTooltips);
    }
    
    return () => {
      // Clean up event listeners
      if (currentRef) {
        currentRef.removeEventListener('click', handleCitationClick);
        currentRef.removeEventListener('mouseenter', handleCitationHover, true);
      }
      
      window.removeEventListener('resize', positionTooltips);
      
      // Remove any lingering backdrops
      const backdrop = document.querySelector('.tooltip-backdrop');
      if (backdrop) backdrop.remove();
    };
  }, []);
  const [claim, setClaim] = useState(initialClaim);
  const [displayedClaim, setDisplayedClaim] = useState(initialClaim);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newFactCheckId, setNewFactCheckId] = useState(null);
  const [recentFactChecks, setRecentFactChecks] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  // Debug the current recentFactChecks state when it changes
  useEffect(() => {
    console.log('Current recentFactChecks state:', recentFactChecks);
  }, [recentFactChecks]);

  useEffect(() => {
    const fetchRecentFactChecks = async () => {
      try {
        const url = `${API_BASE_URL.replace(/\/$/, '')}/api/recent-fact-checks`;
        console.log('Fetching recent fact checks from URL:', url);
        const response = await axios.get(url);
        console.log('Recent fact checks response:', response.data);
        
        if (response.data && response.data.factChecks) {
          console.log('Setting recent fact checks:', response.data.factChecks);
          // Log the structure of the first item to understand the data format
          if (response.data.factChecks.length > 0) {
            console.log('Sample fact check item structure:', JSON.stringify(response.data.factChecks[0], null, 2));
          }
          setRecentFactChecks(response.data.factChecks);
        } else {
          console.warn('No factChecks found in response data:', response.data);
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
  
  const loadFactCheck = (check) => {
    setDisplayedClaim(check.query);
    try {
      // Handle both string and object result formats
      const resultObj = typeof check.result === 'string' ? JSON.parse(check.result) : check.result;
      setResult(resultObj);
      setNewFactCheckId(check.id);
      setClaim('');
      setLoading(false);
      setError('');
    } catch (err) {
      console.error('Error parsing result when loading fact check:', err);
      setError('Error loading fact check result');
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
        <meta property="og:image" content="https://factverify.app/social-share.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        {structuredData && <script type="application/ld+json">{JSON.stringify(structuredData)}</script>}
      </Helmet>
      <main className="main-content-container">
        <div className="form-wrapper">
          <section className="fact-check-form" data-testid="fact-check-form">
            <h2 className="visually-hidden">AI Fact-Checking Portal</h2>
            <div className="form-container">
              <p className="form-description">Enter a claim from news articles, social media posts, or conversations to verify its accuracy. For example: "COVID vaccines contain microchips" or "The Earth is getting cooler, not warmer."</p>
              <p className="form-tip">Tip: Enter specific claims rather than general questions for the best results.</p>
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
          <section className="fact-check-result" aria-live="polite" aria-labelledby="result-heading" ref={resultRef}>
            <h2 className="claim-reviewed">Claim: "{displayedClaim}"</h2>
            <h3 id="result-heading" className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
            <div className="result-content-wrapper">
              <div className="result-explanation">
                {result.summary.split('\n').map((p, i) => (
                  p.trim() ? <p key={i} dangerouslySetInnerHTML={{ __html: formatSourceCitations(p, result.sources) }} /> : null
                ))}
              </div>
              {result.detailed_analysis && (
                <div className="result-detailed-analysis">
                  <h4>Detailed Analysis</h4>
                  {result.detailed_analysis.split('\n').map((p, i) => (
                    p.trim() ? <p key={i} dangerouslySetInnerHTML={{ __html: formatSourceCitations(p, result.sources) }} /> : null
                  ))}
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
      <aside className="sidebar">
        <Carousel 
          title="Fact Check Hub" 
          description="Recent checks & trending claims"
          showIndicators={true}
        >
          {/* Slide 1: Recent Fact Checks */}
          <section className="recent-fact-checks">
            <h3>Recent Fact Checks</h3>
            {recentFactChecks.length > 0 ? (
              <ul className="recent-checks-list">
                {recentFactChecks.map(check => {
                  let verdict = 'unknown';
                  try {
                    // Check if result is already an object or needs to be parsed
                    const resultObj = typeof check.result === 'string' ? JSON.parse(check.result) : check.result;
                    
                    // Extract verdict if available
                    if (resultObj && resultObj.verdict) {
                      verdict = resultObj.verdict.toLowerCase().replace(/\s+/g, '-');
                    }
                  } catch (err) {
                    console.error('Failed to parse verdict for recent fact check:', err, check);
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
          
          {/* Slide 2: Most Searched Claims */}
          <TopSearchedList limit={5} onLoadFactCheck={loadFactCheck} recentFactChecks={recentFactChecks} />
          <TopMisinformationList limit={5} onLoadFactCheck={loadFactCheck} recentFactChecks={recentFactChecks} />
        </Carousel>
      </aside>
    </div>
  );
};

export default FactCheckPage;
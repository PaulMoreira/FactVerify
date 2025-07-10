// src/FactCheckDetailPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import LoadingAnimation from './LoadingAnimation';
import ShareResults from './ShareResults';
import './FactCheck.css'; // Reuse the same styles

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

const FactCheckDetailPage = () => {
  const { id } = useParams();
  const [factCheck, setFactCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const resultRef = useRef(null);

  useEffect(() => {
    const fetchFactCheck = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`/api/get-fact-check?id=${id}`);
        
        // The result from the DB is a string, so we need to parse it.
        const parsedResult = JSON.parse(response.data.result);
        
        setFactCheck({
            ...response.data,
            result: parsedResult // Replace string result with parsed object
        });

      } catch (err) {
        console.error('Error fetching fact-check details:', err);
        setError(err.response?.data?.error || 'Failed to load fact-check. It may have been removed or the link is incorrect.');
      } finally {
        setLoading(false);
      }
    };

    fetchFactCheck();
  }, [id]);
  
  // Add event listeners for tooltip positioning and interactions
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
  }, [factCheck]);

  const generateStructuredData = () => {
    if (!factCheck || !factCheck.result) return null;

    const ratingMap = {
      'true': 5,
      'mostly true': 4,
      'mixture': 3,
      'mostly false': 2,
      'false': 1,
      'misleading': 2.5,
    };

    const verdictText = factCheck.result.verdict?.toLowerCase().replace(/\s+/g, ' ') || '';
    const numericRating = ratingMap[verdictText];

    const claimReview = {
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      "url": `https://factverify.app/fact-check/${factCheck.id}`,
      "datePublished": factCheck.created_at,
      "claimReviewed": factCheck.query,
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
        "alternateName": factCheck.result.verdict
      };
    } else {
        claimReview.reviewRating = {
            "@type": "Rating",
            "alternateName": factCheck.result.verdict
        }
    }

    return claimReview;
  };

  const structuredData = generateStructuredData();

  if (loading) {
    return <LoadingAnimation />;
  }

  if (error) {
    return (
      <main className="fact-check-container">
        <div className="error" role="alert">{error}</div>
        <Link to="/" className="home-link">Back to Homepage</Link>
      </main>
    );
  }

  if (!factCheck) {
    return null; // Should be handled by loading/error states
  }

  const { query, result } = factCheck;

  return (
    <main className="fact-check-container">
        <Helmet>
            <title>{`Fact Check: ${query.substring(0, 60)}...`}</title>
            <meta name="description" content={result.summary} />
            <link rel="canonical" href={`https://factverify.app/fact-check/${id}`} />
            <meta property="og:title" content={`Fact Check: ${query}`} />
            <meta property="og:description" content={result.summary} />
            <meta property="og:url" content={`https://factverify.app/fact-check/${id}`} />
            {structuredData && (
              <script type="application/ld+json">
                {JSON.stringify(structuredData)}
              </script>
            )}
        </Helmet>

        <section className="fact-check-result" aria-live="polite" aria-labelledby="result-heading" ref={resultRef}>
            <h2 className="claim-reviewed">Claim: "{query}"</h2>
            <h3 id="result-heading" className={`verdict-${result.verdict.toLowerCase().replace(/\s+/g, '-')}`}>Verdict: {result.verdict}</h3>
            <div className="result-content-wrapper">
                <div className="result-explanation">
                    {result.summary.split('\n').map((paragraph, idx) => (
                    paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
                    ))}
                </div>
                
                {result.detailed_analysis && (
                    <div className="result-detailed-analysis">
                    <h4>Detailed Analysis</h4>
                    {result.detailed_analysis.split('\n').map((paragraph, idx) => (
                        paragraph.trim() ? 
                          <p key={idx} dangerouslySetInnerHTML={{ __html: formatSourceCitations(paragraph, result.sources) }}></p> : 
                          null
                    ))}
                    </div>
                )}
                
                {result.sources && result.sources.length > 0 && (
                  <div className="result-sources">
                    <h4>Sources:</h4>
                    <div className="source-cards-container">
                      {result.sources.map((src, i) => (
                        <a href={src.url} key={i} className="source-card" target="_blank" rel="noopener noreferrer">
                          <div className="source-card-image">
                            <img 
                              src={src.image || `https://www.google.com/s2/favicons?domain=${new URL(src.url).hostname}&sz=128`}
                              alt={`${new URL(src.url).hostname} favicon`}
                              onError={(e) => { e.target.onerror = null; e.target.src='https://factverify.app/favicon.svg'; }}
                            />
                          </div>
                          <div className="source-card-content">
                            <p className="source-card-title">{src.title}</p>
                            <p className="source-card-domain">{new URL(src.url).hostname}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="confidence-meter">
                    <strong>Confidence:</strong> <span className={`confidence-${result.confidence.toLowerCase()}`}>{result.confidence}</span>
                </div>

                <ShareResults result={result} claim={query} url={`https://factverify.app/fact-check/${id}`} />
                
                <div className="action-buttons-container">
                  <Link to="/" className="action-button check-another-button">
                    <span className="button-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    Check another claim
                  </Link>
                </div>
            </div>
        </section>
    </main>
  );
};

export default FactCheckDetailPage;

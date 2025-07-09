// src/FactCheckDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import LoadingAnimation from './LoadingAnimation';
import ShareResults from './ShareResults';
import './FactCheck.css'; // Reuse the same styles

const FactCheckDetailPage = () => {
  const { id } = useParams();
  const [factCheck, setFactCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        <section className="fact-check-result" aria-live="polite" aria-labelledby="result-heading">
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
                        paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
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

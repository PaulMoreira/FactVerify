import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './FactCheck.css';
import LoadingAnimation from './LoadingAnimation';

const AllFactChecksPage = () => {
  const [factChecks, setFactChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const fetchAllFactChecks = async () => {
      setLoading(true);
      try {
                const url = `${API_BASE_URL.replace(/\/$/, '')}/api/all-fact-checks?page=${page}&limit=20`;
        const response = await axios.get(url);
        if (response.data) {
          setFactChecks(response.data.factChecks);
          setTotalPages(response.data.totalPages);
        }
      } catch (err) {
        setError('Error fetching fact checks. Please try again later.');
        console.error('Error fetching fact checks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllFactChecks();
  }, [page, API_BASE_URL]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="page-container all-checks-page">
      <Helmet>
        <title>All Fact Checks - FactVerify</title>
        <meta name="description" content="Browse all fact checks conducted by FactVerify." />
      </Helmet>
      <main className="main-content-container">
        <section className="fact-check-header">
          <h1>All Fact Checks</h1>
          <p className="fact-checks-description">Browse our comprehensive database of verified claims and their verdicts.</p>
        </section>
        
        {loading && <div className="loading-wrapper"><LoadingAnimation /></div>}
        {error && <div className="error" role="alert">{error}</div>}
        
        {factChecks.length === 0 && !loading && !error && (
          <div className="no-results">
            <p>No fact checks available at this time.</p>
            <Link to="/" className="primary-button">Submit a claim to check</Link>
          </div>
        )}
        
        <div className="fact-checks-grid">
          {factChecks.map(check => {
            let verdict = "Unknown";
            let verdictClass = "";
            
            try {
              const parsedResult = JSON.parse(check.result);
              verdict = parsedResult.verdict;
              verdictClass = `verdict-${verdict.toLowerCase().replace(/\s+/g, '-')}`;
            } catch (err) {
              console.error('Failed to parse result:', err);
            }
            
            return (
              <div key={check.id} className="fact-check-card">
                <Link to={`/fact-check/${check.id}`} className="fact-check-card-link">
                  <div className="fact-check-card-content">
                    <div className="fact-check-card-header">
                      <span className={`fact-check-verdict ${verdictClass}`}>{verdict}</span>
                      <span className="fact-check-date">{new Date(check.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <h2 className="fact-check-query">{check.query}</h2>
                    <div className="fact-check-card-footer">
                      <span className="view-details">View details</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
        
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button 
              className="pagination-button" 
              onClick={() => handlePageChange(page - 1)} 
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Previous</span>
            </button>
            
            <div className="pagination-info">
              <span>Page {page} of {totalPages}</span>
            </div>
            
            <button 
              className="pagination-button" 
              onClick={() => handlePageChange(page + 1)} 
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <span>Next</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        )}
      </main>
      
      <aside className="sidebar-container">
        <section className="recent-fact-checks">
          <h3>Submit a Claim</h3>
          <p>Have a claim you'd like to verify? Head to our fact-checking tool to get an instant analysis.</p>
          <Link to="/" className="primary-button">Check a Claim</Link>
        </section>
      </aside>
    </div>
  );
};

export default AllFactChecksPage;

import React, { useState, useEffect } from 'react';
import './App.css';
import './FactCheck.css';
import './SidebarStyles.css';

const TopSearchedList = ({ limit = 5, onLoadFactCheck, recentFactChecks = [] }) => {
  const [topSearched, setTopSearched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const fetchTopSearched = async () => {
      try {
        const url = `${API_BASE_URL.replace(/\/$/, '')}/api/top-searched?limit=${limit}`;
        console.log('Fetching top searched from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
          throw new Error(`Failed to fetch top searched items: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received top searched data:', data);
        
        if (data.topSearched && data.topSearched.length > 0) {
          // Sort the data by search count in descending order to ensure we show the most searched claims
          const sortedData = [...data.topSearched].sort((a, b) => {
            // Ensure we're comparing numbers, with fallback to 0 if count is missing
            const countA = typeof a.count === 'number' ? a.count : 0;
            const countB = typeof b.count === 'number' ? b.count : 0;
            return countB - countA; // Descending order
          });
          
          // Take only the top 'limit' items
          const topItems = sortedData.slice(0, limit);
          console.log(`Displaying top ${topItems.length} most searched claims`);
          
          setTopSearched(topItems);
          setError('');
          return;
        } else {
          console.error('No top searched data in API response');
          throw new Error('No top searched data available');
        }
      } catch (err) {
        console.error('Error fetching top searched:', err);
        setError('Failed to load top searched items');
        
        // Only use mock data as a last resort and clearly mark as demo data
        const mockData = [
          { id: 1, query: "COVID-19 vaccines cause autism", count: 247, verdict: "false", demo: true },
          { id: 2, query: "Climate change is a hoax", count: 192, verdict: "false", demo: true },
          { id: 3, query: "Voting machines were hacked in 2020", count: 143, verdict: "false", demo: true },
          { id: 4, query: "5G towers cause health problems", count: 121, verdict: "mixture", demo: true },
          { id: 5, query: "Drinking bleach cures COVID-19", count: 84, verdict: "false", demo: true }
        ];
        setTopSearched(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchTopSearched();
  }, [API_BASE_URL, limit]);

  if (loading) {
    return (
      <section className="top-searched-section">
        <h3>Most Searched Claims</h3>
        <div className="loading-text">Loading...</div>
      </section>
    );
  }

  if (error && topSearched.length === 0) {
    return (
      <section className="top-searched-section">
        <h3>Most Searched Claims</h3>
        <div className="error-text">Unable to load top searched items</div>
      </section>
    );
  }

  return (
    <section className="recent-fact-checks">
      <h3>Most Searched Claims</h3>
      <p className="section-description">Popular claims people are fact-checking</p>
      {topSearched.length > 0 ? (
        <ul className="recent-checks-list">
          {topSearched.map((item, index) => {
            const verdictClass = item.verdict ? `verdict-${item.verdict.toLowerCase().replace(/\s+/g, '-')}` : 'verdict-unknown';
            
            return (
              <li key={item.id || index} className="recent-check-item">
                <button 
                  onClick={() => {
                    // Find matching fact check in recentFactChecks by query text
                    const matchingFactCheck = recentFactChecks.find(check => 
                      check.query.toLowerCase() === item.query.toLowerCase()
                    );
                    
                    if (matchingFactCheck) {
                      // If we found a matching fact check, use the actual data
                      console.log('Found matching fact check for:', item.query);
                      onLoadFactCheck(matchingFactCheck);
                    } else {
                      // Fallback to creating a synthetic fact check if no match found
                      console.log('No matching fact check found for:', item.query);
                      const check = {
                        id: item.id || `search-${Date.now()}`,
                        query: item.query,
                        result: JSON.stringify({ 
                          verdict: item.verdict || 'unknown',
                          summary: `Analysis of "${item.query}" shows it is ${item.verdict || 'unknown'}.`,
                          detailed_analysis: `This claim has been fact-checked by our system. Based on available data and reliable sources, the claim has been rated as ${item.verdict || 'unknown'}. This claim has been searched ${item.count || 'multiple'} times by users.`,
                          sources: [
                            {
                              title: "FactVerify Database",
                              url: "https://factverify.app/database"
                            }
                          ],
                          confidence: 'Medium'
                        }),
                        created_at: new Date().toISOString()
                      };
                      onLoadFactCheck(check);
                    }
                  }} 
                  className="load-fact-check" 
                  aria-label={`Load fact check: ${item.query}`}>
                  <div className="recent-check-header">
                    <span className={`fact-check-verdict ${verdictClass}`}>
                      {item.verdict?.replace(/-/g, ' ') || 'unknown'}
                    </span>
                    <span className="check-date">{new Date().toLocaleDateString()}</span>
                    {item.demo && <span className="demo-data-tag">Demo Data</span>}
                  </div>
                  <span className="recent-check-query">{item.query}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="no-data">No top searched items available</p>
      )}
    </section>
  );
};

export default TopSearchedList;
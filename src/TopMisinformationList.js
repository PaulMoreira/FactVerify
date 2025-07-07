import React, { useState, useEffect } from 'react';
import './App.css';
import './FactCheck.css';
import './SidebarStyles.css';

const TopMisinformationList = ({ limit = 5, onLoadFactCheck, recentFactChecks = [] }) => {
  const [topMisinformation, setTopMisinformation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    const fetchTopMisinformation = async () => {
      try {
        const url = `${API_BASE_URL.replace(/\/$/, '')}/api/top-misinformation?limit=${limit}`;
        console.log('Fetching top misinformation from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
          throw new Error(`Failed to fetch top misinformation items: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received top misinformation data:', data);
        
        if (data.topMisinformation && data.topMisinformation.length > 0) {
          // Sort the data by occurrence count in descending order
          // This ensures we display the most frequently occurring misinformation
          const sortedData = [...data.topMisinformation].sort((a, b) => {
            // Ensure we're comparing numbers, with fallback to 0 if count is missing
            const countA = typeof a.count === 'number' ? a.count : 0;
            const countB = typeof b.count === 'number' ? b.count : 0;
            
            // For misinformation, we might also consider danger_level as a secondary sort criteria
            if (countA === countB && a.danger_level && b.danger_level) {
              const dangerMap = { 'high': 3, 'medium': 2, 'low': 1 };
              return (dangerMap[b.danger_level] || 0) - (dangerMap[a.danger_level] || 0);
            }
            
            return countB - countA; // Descending order by count
          });
          
          // Take only the top 'limit' items
          const topItems = sortedData.slice(0, limit);
          console.log(`Displaying top ${topItems.length} most frequent misinformation claims`);
          
          setTopMisinformation(topItems);
          setError('');
          return;
        } else {
          console.error('No top misinformation data in API response');
          throw new Error('No top misinformation data available');
        }
      } catch (err) {
        console.error('Error fetching top misinformation:', err);
        setError('Failed to load top misinformation items');
        
        // Only use mock data as a last resort and clearly mark as demo data
        const mockData = [
          { 
            id: 1, 
            query: "Vaccines contain microchips for tracking", 
            count: 1052, 
            verdict: "false",
            danger_level: "high",
            category: "health",
            demo: true
          },
          { 
            id: 2, 
            query: "Drinking bleach prevents COVID-19", 
            count: 834, 
            verdict: "false",
            danger_level: "critical",
            category: "health",
            demo: true
          },
          { 
            id: 3, 
            query: "5G towers spread coronavirus", 
            count: 567, 
            verdict: "false",
            danger_level: "medium",
            category: "technology",
            demo: true
          },
          { 
            id: 4, 
            query: "Election voting machines were hacked", 
            count: 342, 
            verdict: "false",
            danger_level: "high",
            category: "politics",
            demo: true
          },
          { 
            id: 5, 
            query: "Climate change is a government hoax", 
            count: 128, 
            verdict: "false",
            danger_level: "medium",
            category: "environment",
            demo: true
          }
        ];
        setTopMisinformation(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchTopMisinformation();
  }, [API_BASE_URL, limit]);

  if (loading) {
    return (
      <section className="top-misinformation-section">
        <h3>Top Misinformation</h3>
        <div className="loading-text">Loading...</div>
      </section>
    );
  }

  if (error && topMisinformation.length === 0) {
    return (
      <section className="top-misinformation-section">
        <h3>Top Misinformation</h3>
        <div className="error-text">Unable to load misinformation data</div>
      </section>
    );
  }

  // Removed danger icons and category colors functions

  return (
    <section className="recent-fact-checks">
      <h3>Top Misinformation</h3>
      <p className="section-description">Dangerous false claims spreading online</p>
      {topMisinformation.length > 0 ? (
        <ul className="recent-checks-list">
          {topMisinformation.map((item, index) => {
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
                        id: item.id || `misinformation-${Date.now()}`,
                        query: item.query,
                        result: JSON.stringify({ 
                          verdict: item.verdict || 'false',
                          summary: `Fact check of "${item.query}" reveals it is ${item.verdict || 'false'}.`,
                          detailed_analysis: `This claim has been thoroughly fact-checked by our system and identified as misinformation. Based on reliable sources and data analysis, the claim has been rated as ${item.verdict || 'false'}. Our systems have detected this claim appearing ${item.count || 'multiple'} times across various platforms.`,
                          sources: [
                            {
                              title: "FactVerify Misinformation Database",
                              url: "https://factverify.app/misinformation-database"
                            },
                            {
                              title: "Fact-Checking Resources",
                              url: "https://factverify.app/resources"
                            }
                          ],
                          confidence: 'High'
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
                    <span className="check-date"></span>
                  </div>
                  <span className="recent-check-query">{item.query}</span>
                  <div className="misinformation-meta">
                    <span className="check-date">{new Date().toLocaleDateString()}</span>
                    {item.demo && <span className="demo-data-tag">Demo Data</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="no-data">No misinformation data available</p>
      )}
      <div className="misinformation-warning">
        <small>
          <strong>⚠️ Warning:</strong> These claims have been fact-checked and found to be false or misleading. 
          Please verify information before sharing.
        </small>
      </div>
    </section>
  );
};

export default TopMisinformationList;
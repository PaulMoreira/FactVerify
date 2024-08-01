import React from 'react';
import { Link } from 'react-router-dom';
import articleData from './articleData';

const WhatsNewSection = () => {
  // Sort articles by date (newest first) and take the top 3
  const sortedArticles = [...articleData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return (
    <div className="whats-new-section">
      <h2>Latest Insights</h2>
      <ul>
        {sortedArticles.map((article, index) => (
          <li key={index}>
            <span className="date">{article.date}</span>
            <h3>
              <Link to={`/insights/${article.id}`}>{article.headline}</Link>
            </h3>
            <p>{article.summary}</p>
          </li>
        ))}
      </ul>
      <Link to="/insights" className="view-all-link">View All Election Insights</Link>
    </div>
  );
};

export default WhatsNewSection;
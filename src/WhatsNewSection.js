import React from 'react';
import { Link } from 'react-router-dom';
import articleData from './articleData';

const WhatsNewSection = () => {
  // Sort articles by date and get the latest 2
  const latestArticles = [...articleData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 2);

  return (
    <div className="whats-new-section">
      <h2>Latest Insights</h2>
      <ul>
        {latestArticles.map((article, index) => (
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
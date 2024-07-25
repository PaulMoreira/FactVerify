import React from 'react';
import { Link } from 'react-router-dom';

const ElectionInsightsPage = () => {
  const insightArticles = [
    {
      id: "dei-landscape-2024",
      date: "July 24, 2024",
      headline: "The Evolving Landscape of Diversity, Equity, and Inclusion (DEI) in 2024",
      summary: "Explore the complex intersection of corporate commitments, political strategies, and societal implications of DEI initiatives in 2024."
    }
  ];

  return (
    <div className="election-insights-page">
      <h1>Election Insights</h1>
      <p>Deep dives into key election issues and candidate policies</p>
      <div className="insights-list">
        {insightArticles.map((article, index) => (
          <div key={index} className="insight-article">
            <h2><Link to={`/insights/${article.id}`}>{article.headline}</Link></h2>
            <p className="article-date">{article.date}</p>
            <p className="article-summary">{article.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ElectionInsightsPage;
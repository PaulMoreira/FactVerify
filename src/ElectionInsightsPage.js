import React from 'react';
import { Link } from 'react-router-dom';
import { articles } from './articleData';

const ElectionInsightsPage = () => {
  return (
    <div className="election-insights-page">
      <h1>Election Insights</h1>
      <p>Deep dives into key election issues and candidate policies</p>
      <div className="insights-list">
        {articles.map((article, index) => (
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
import React from 'react';
import { Link } from 'react-router-dom';

const WhatsNewSection = () => {
  const newFeatures = [
    {
      date: "July 24, 2024",
      headline: "The Evolving Landscape of Diversity, Equity, and Inclusion (DEI) in 2024",
      link: "/insights/dei-landscape-2024",
      summary: "Explore the complex intersection of corporate commitments, political strategies, and societal implications of DEI initiatives in 2024."    },
  ];

  return (
    <div className="whats-new-section">
      <h2>Latest Insights</h2>
      <ul>
        {newFeatures.map((item, index) => (
          <li key={index}>
            <span className="date">{item.date}</span>
            <h3>
              <Link to={item.link}>{item.headline}</Link>
            </h3>
            <p>{item.summary}</p>
          </li>
        ))}
      </ul>
      <Link to="/insights" className="view-all-link">View All Election Insights</Link>
    </div>
  );
};

export default WhatsNewSection;
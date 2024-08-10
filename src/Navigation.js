import React from 'react';
import { Link } from 'react-router-dom';
import { articleData } from './articleData';

const Navigation = () => {
  // Sort articles by date (newest first) and take the top 3
  const latestArticles = [...articleData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Voter Resources", path: "/resources" },
    { 
      name: "Election Insights", 
      path: "/insights",
      subItems: [
        ...latestArticles.map(article => ({
          name: article.headline,
          path: `/insights/${article.id}`
        })),
        { name: "Read More Insights...", path: "/insights" }
      ]
    }
  ];

  return (
    <nav className="main-navigation">
      <ul>
        {navItems.map((item, index) => (
          <li key={index}>
            <Link to={item.path}>{item.name}</Link>
            {item.subItems && (
              <ul className="sub-menu">
                {item.subItems.map((subItem, subIndex) => (
                  <li key={subIndex}>
                    <Link 
                      to={subItem.path}
                      className={subItem.name === "Read More Insights..." ? "read-more" : ""}
                    >
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;
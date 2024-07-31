import React from 'react';
import { Link } from 'react-router-dom';
import { articleData } from './articleData';

const Navigation = () => {
  const navItems = [
    { name: "Home", path: "/" },
    { name: "Voter Resources", path: "/resources" },
    { 
      name: "Election Insights", 
      path: "/insights",
      subItems: articleData.map(article => ({
        name: article.headline,
        path: `/insights/${article.id}`
      }))
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
                    <Link to={subItem.path}>{subItem.name}</Link>
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
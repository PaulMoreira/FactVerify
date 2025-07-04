import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ScrollToTopLink - A custom Link component that scrolls to the top of the page when clicked
 * 
 * This component wraps the standard react-router-dom Link component and adds
 * functionality to scroll the window to the top when the link is clicked.
 * 
 * @param {Object} props - Component props including 'to' for the destination path
 * @returns {React.Component} - Enhanced Link component with scroll-to-top behavior
 */
const ScrollToTopLink = ({ children, to, ...props }) => {
  const handleClick = () => {
    // Scroll to top with smooth animation
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <Link to={to} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};

export default ScrollToTopLink;

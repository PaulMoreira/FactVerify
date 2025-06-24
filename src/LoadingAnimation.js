import React from 'react';
import './LoadingAnimation.css';

const LoadingAnimation = () => {
  return (
    <div className="loading-container" role="status" aria-label="Fact-checking in progress">
      <div className="loading-text">AI is researching...</div>
      <div className="loading-animation">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
      </div>
      <div className="loading-subtext">Analyzing sources and verifying information</div>
    </div>
  );
};

export default LoadingAnimation;

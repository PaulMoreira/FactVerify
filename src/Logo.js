import React from 'react';

const Logo = () => (
  <div className="logo-container" aria-label="FactVerify Logo">
    <svg 
      viewBox="0 0 220 50" 
      xmlns="http://www.w3.org/2000/svg" 
      className="fact-verify-logo"
      aria-labelledby="logoTitle"
      role="img"
    >
      <title id="logoTitle">FactVerify Logo</title>
      {/* Shield Icon */}
      <g className="logo-icon">
        <path 
          className="logo-icon-shield"
          d="M25 2 C15 2 5 10 5 20 L5 30 C5 40 15 48 25 48 C35 48 45 40 45 30 L45 20 C45 10 35 2 25 2 Z" 
        />
        <path 
          className="logo-icon-check"
          d="M16 25 L23 32 L34 21" 
        />
      </g>
      {/* Text */}
      <text x="55" y="33" className="logo-text">
        <tspan className="logo-text-fact">Fact</tspan>
        <tspan className="logo-text-verify">Verify</tspan>
      </text>
    </svg>
  </div>
);

export default Logo;

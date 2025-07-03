import React, { useState } from 'react';
import './ShareResults.css';

const ShareResults = ({ result, claim }) => {
  const [copied, setCopied] = useState(false);
  
  // Generate share text
  const shareText = `Fact Check: "${claim}" - Verdict: ${result.verdict}. Check out the full analysis at AI Fact Verify: https://factverify.app`;
  
  // Copy to clipboard function
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="share-results">
      <button 
        onClick={copyToClipboard} 
        className={`copy-button ${copied ? 'copied' : ''}`}
        aria-label="Copy fact check to clipboard"
      >
        <div className="copy-button-content">
          <span className="copy-icon">{copied ? '✅' : '📋'}</span>
          <span className="copy-text">{copied ? 'Copied to clipboard!' : 'Copy this fact check'}</span>
        </div>
        <div className="copy-tooltip">
          Share on social media
        </div>
      </button>
    </div>
  );
};

export default ShareResults;

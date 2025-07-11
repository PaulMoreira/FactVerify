import React, { useState } from 'react';
import './ShareResults.css';

const ShareResults = ({ result, claim }) => {
  const [copied, setCopied] = useState(false);
  
  // Generate share text with summary if available
  const generateShareText = () => {
    let text = `Fact Check: "${claim}" - Verdict: ${result.verdict}`;
    
    // Add summary if available, removing any citation markers for clean sharing
    if (result.summary) {
      const cleanSummary = result.summary.replace(/\(SOURCE_\d+(?:,\s*SOURCE_\d+)*\)/g, '').trim();
      text += `\n\nSummary: ${cleanSummary}`;
    }
    
    text += `\n\nCheck out the full analysis at Fact Verify: https://factverify.app`;
    return text;
  };
  
  const shareText = generateShareText();
  
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
          <span className="copy-icon">
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2H8C7.46957 2 6.96086 2.21071 6.58579 2.58579C6.21071 2.96086 6 3.46957 6 4V18C6 18.5304 6.21071 19.0391 6.58579 19.4142C6.96086 19.7893 7.46957 20 8 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
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

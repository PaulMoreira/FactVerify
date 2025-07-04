import React, { useState, useRef, useEffect } from 'react';
import './SourceCitation.css';

const SourceCitation = ({ sourceId, sourceInfo, children }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const citationRef = useRef(null);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && isTooltipVisible && citationRef.current && !citationRef.current.contains(event.target)) {
        setIsTooltipVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, isTooltipVisible]);

  const handleCitationClick = (e) => {
    if (isMobile) {
      e.preventDefault();
      setIsTooltipVisible(!isTooltipVisible);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsTooltipVisible(!isTooltipVisible);
    } else if (e.key === 'Escape' && isTooltipVisible) {
      setIsTooltipVisible(false);
    }
  };

  return (
    <>
      {isMobile && isTooltipVisible && (
        <div 
          className="tooltip-backdrop active" 
          onClick={() => setIsTooltipVisible(false)}
          aria-hidden="true"
        />
      )}
      <span
        ref={citationRef}
        className={`source-citation ${isTooltipVisible ? 'active' : ''}`}
        onClick={handleCitationClick}
        onMouseEnter={() => !isMobile && setIsTooltipVisible(true)}
        onMouseLeave={() => !isMobile && setIsTooltipVisible(false)}
        onFocus={() => !isMobile && setIsTooltipVisible(true)}
        onBlur={() => !isMobile && setIsTooltipVisible(false)}
        onKeyDown={handleKeyDown}
        tabIndex="0"
        role="button"
        aria-label={`Source ${sourceId}: ${sourceInfo?.title || 'Citation'}`}
      >
        {children || sourceId}
        <span 
          className="source-tooltip" 
          role="tooltip"
          aria-hidden={!isTooltipVisible}
        >
          {sourceInfo?.title || `Source ${sourceId}`}
          {sourceInfo?.domain && (
            <span style={{ display: 'block', fontSize: '0.8em', color: '#718096' }}>
              {sourceInfo.domain}
            </span>
          )}
        </span>
      </span>
    </>
  );
};

export default SourceCitation;

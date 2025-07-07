import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Carousel.css';

/**
 * A minimalist, elegant carousel component for displaying content in slides.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode[]} props.children - Slides to display in the carousel
 * @param {string} props.title - Title of the carousel section
 * @param {string} props.description - Optional description text
 * @param {number} props.autoplayInterval - Optional interval for autoplay in ms (0 to disable)
 * @param {boolean} props.showIndicators - Whether to show slide indicators
 * @param {string} props.className - Additional CSS class names
 * @returns {React.ReactElement} Carousel component
 */
const Carousel = ({ 
  children, 
  title, 
  description, 
  autoplayInterval = 0, 
  showIndicators = true,
  className = ''
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const carouselRef = useRef(null);
  const autoplayTimerRef = useRef(null);
  const slides = React.Children.toArray(children);
  
  // Handle autoplay if enabled
  useEffect(() => {
    if (autoplayInterval > 0) {
      autoplayTimerRef.current = setInterval(() => {
        setActiveIndex((current) => (current + 1) % slides.length);
      }, autoplayInterval);
      
      return () => {
        if (autoplayTimerRef.current) {
          clearInterval(autoplayTimerRef.current);
        }
      };
    }
  }, [autoplayInterval, slides.length]);
  
  // Reset autoplay when user interacts with carousel
  const resetAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current && autoplayInterval > 0) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = setInterval(() => {
        setActiveIndex((current) => (current + 1) % slides.length);
      }, autoplayInterval);
    }
  }, [autoplayInterval, slides.length]);
  
  const handlePrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
    resetAutoplayTimer();
  }, [slides.length, resetAutoplayTimer]);
  
  const handleNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % slides.length);
    resetAutoplayTimer();
  }, [slides.length, resetAutoplayTimer]);
  
  const goToSlide = (index) => {
    setActiveIndex(index);
    resetAutoplayTimer();
  };
  
  // Touch event handlers for swipe functionality
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left
      handleNext();
    } else if (touchEnd - touchStart > 75) {
      // Swipe right
      handlePrevious();
    }
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement === carouselRef.current || 
          carouselRef.current?.contains(document.activeElement)) {
        if (e.key === 'ArrowLeft') {
          handlePrevious();
        } else if (e.key === 'ArrowRight') {
          handleNext();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlePrevious, handleNext]);
  
  return (
    <section 
      className={`carousel-container ${className}`}
      ref={carouselRef}
      tabIndex="0"
      aria-roledescription="carousel"
      aria-label={title}
    >
      {title && <h3 className="carousel-title">{title}</h3>}
      {description && <p className="carousel-description">{description}</p>}
      
      <div 
        className="carousel-track"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="carousel-slides"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          aria-live="polite"
        >
          {slides.map((slide, index) => (
            <div 
              key={index} 
              className={`carousel-slide ${index === activeIndex ? 'active' : ''}`}
              aria-hidden={index !== activeIndex}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>
      
      <div className="carousel-controls">
        <button 
          className="carousel-control prev"
          onClick={handlePrevious}
          aria-label="Previous slide"
        >
          &#10094;
        </button>
        
        {showIndicators && (
          <div className="carousel-indicators">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`carousel-indicator ${index === activeIndex ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeIndex}
              />
            ))}
          </div>
        )}
        
        <button 
          className="carousel-control next"
          onClick={handleNext}
          aria-label="Next slide"
        >
          &#10095;
        </button>
      </div>
    </section>
  );
};

export default Carousel;

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ScrollToTopLink from './components/ScrollToTopLink';
import './App.css';
import FactCheckPage from './FactCheckPage.js';
import FactCheckDetailPage from './FactCheckDetailPage.js';
import AllFactChecksPage from './AllFactChecksPage.js';
import AboutPage from './AboutPage.js';
import DisclaimerPage from './DisclaimerPage.js';
import Logo from './Logo';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { HelmetProvider } from 'react-helmet-async';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  
  // Check for user preference on initial load
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode !== null) {
      setDarkMode(savedMode === 'true');
    } else if (prefersDark) {
      setDarkMode(true);
    }
  }, []);
  
  // Update body class and localStorage when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) && 
          !event.target.classList.contains('hamburger-button')) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);
  
  return (
    <HelmetProvider>
      <Router>
      <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
        <header>
          <div className="header-content">
            <div className="header-left">
              <ScrollToTopLink to="/" className="logo-link">
                <Logo />
              </ScrollToTopLink>
            </div>
            
            <nav className="desktop-nav">
              <ScrollToTopLink to="/fact-checks">All Fact Checks</ScrollToTopLink>
              <ScrollToTopLink to="/about">About</ScrollToTopLink>
              <ScrollToTopLink to="/disclaimer">Disclaimer</ScrollToTopLink>
              <button 
                className="theme-toggle desktop" 
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </button>
            </nav>
            
            <div className="header-right">
              {/* Hamburger Menu Button - only shown when mobile menu is closed */}
              {!mobileMenuOpen && (
                <button 
                  className="hamburger-button" 
                  onClick={toggleMobileMenu} 
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <div className="hamburger-icon">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </button>
              )}
            </div>
            
            {/* Mobile Navigation Overlay */}
            <div 
              className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`}
              ref={mobileMenuRef}
              aria-hidden={!mobileMenuOpen}
            >
              <div className="mobile-nav-container">
                <div className="mobile-nav-header">
                  <ScrollToTopLink to="/" className="mobile-logo" onClick={() => setMobileMenuOpen(false)}>
                    <Logo />
                  </ScrollToTopLink>
                  <button 
                    className="close-menu-button" 
                    onClick={toggleMobileMenu}
                    aria-label="Close navigation menu"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <nav className="mobile-nav">
                  <ScrollToTopLink to="/fact-checks" onClick={() => setMobileMenuOpen(false)}>All Fact Checks</ScrollToTopLink>
                  <ScrollToTopLink to="/about" onClick={() => setMobileMenuOpen(false)}>About</ScrollToTopLink>
                  <ScrollToTopLink to="/disclaimer" onClick={() => setMobileMenuOpen(false)}>Disclaimer</ScrollToTopLink>
                </nav>
                <div className="mobile-nav-footer">
                  <button 
                    className="theme-toggle mobile" 
                    onClick={toggleDarkMode}
                    aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<FactCheckPage />} />
          <Route path="/fact-check/:id" element={<FactCheckDetailPage />} />
          <Route path="/fact-checks" element={<AllFactChecksPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
        </Routes>
        <footer>
          <div className="footer-links">
            <ScrollToTopLink to="/">Home</ScrollToTopLink>
            <ScrollToTopLink to="/about">About</ScrollToTopLink>
            <ScrollToTopLink to="/disclaimer">Disclaimer</ScrollToTopLink>
          </div>
          <p>&copy; 2025 FactVerify. All rights reserved.</p>
          <p>Powered by OpenAI and real-time web research.</p>
        </footer>
        <Analytics />
        <SpeedInsights/>
      </div>
          </Router>
    </HelmetProvider>
  );
};

export default App;
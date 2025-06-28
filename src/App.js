import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import FactCheckPage from './FactCheckPage.js';
import FactCheckDetailPage from './FactCheckDetailPage.js';
import Logo from './Logo';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { HelmetProvider } from 'react-helmet-async';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  
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
  
  return (
    <HelmetProvider>
      <Router>
      <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
        <header>
          <div className="header-content">
            <Logo />
            <button 
              className="theme-toggle" 
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<FactCheckPage />} />
          <Route path="/fact-check/:id" element={<FactCheckDetailPage />} />
        </Routes>
        <footer>
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
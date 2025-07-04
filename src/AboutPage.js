import React from 'react';
import { Helmet } from 'react-helmet-async';
import './App.css';
import './AboutDisclaimer.css';

/**
 * AboutPage component - Provides information about the FactVerify application
 * 
 * Follows the elegant simplicity principles of Knuth, Ritchie, and Thompson
 */
const AboutPage = () => {
  return (
    <div className="container">
      <Helmet>
        <title>About FactVerify - AI-Powered Fact Checking</title>
        <meta name="description" content="Learn about FactVerify, an AI-powered fact-checking tool that helps verify claims using real-time web research and advanced language models." />
      </Helmet>
      
      <main className="content-area">
        <section className="about-section">
          <h1>About FactVerify</h1>
          
          <div className="about-content">
            <h2>Our Mission</h2>
            <p>
              FactVerify is dedicated to promoting truth and accuracy in information by providing 
              an accessible, transparent fact-checking tool powered by artificial intelligence and 
              real-time web research.
            </p>
            
            <h2>What We Do</h2>
            <p>
              FactVerify analyzes claims by searching the web for relevant, up-to-date information 
              and using advanced language models to evaluate the veracity of statements. For each claim, 
              we provide:
            </p>
            <ul>
              <li><strong>Verdict</strong> - Whether the claim is true, false, or somewhere in between</li>
              <li><strong>Summary</strong> - A concise explanation of our findings</li>
              <li><strong>Sources</strong> - Citations to the information used in our analysis</li>
              <li><strong>Confidence</strong> - An assessment of how certain we are in our verdict</li>
            </ul>
            
            <h2>How It Works</h2>
            <p>
              When you submit a claim to FactVerify, our system:
            </p>
            <ol>
              <li>Searches the web for relevant, recent information about your claim</li>
              <li>Analyzes the search results using OpenAI's language models</li>
              <li>Evaluates the claim against the evidence found</li>
              <li>Provides a structured response with sources you can verify yourself</li>
            </ol>
            
            <h2>Our Technology</h2>
            <p>
              FactVerify combines several cutting-edge technologies:
            </p>
            <ul>
              <li>Real-time web search and content analysis</li>
              <li>OpenAI's advanced language models</li>
              <li>Custom algorithms for source evaluation and citation</li>
              <li>A modern, accessible user interface</li>
            </ul>
            
            <h2>Limitations</h2>
            <p>
              While we strive for accuracy, FactVerify has certain limitations:
            </p>
            <ul>
              <li>Results depend on the quality and availability of information online</li>
              <li>Very recent events may not have sufficient reliable sources yet</li>
              <li>Complex or nuanced claims may require additional context</li>
              <li>AI systems, while powerful, are not infallible</li>
            </ul>
            
            <h2>Our Commitment</h2>
            <p>
              We are committed to:
            </p>
            <ul>
              <li>Transparency in our methods and sources</li>
              <li>Continuous improvement of our fact-checking capabilities</li>
              <li>Providing a tool that helps users make informed decisions</li>
              <li>Respecting user privacy and data security</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutPage;

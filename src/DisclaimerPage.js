import React from 'react';
import { Helmet } from 'react-helmet-async';
import './App.css';
import './AboutDisclaimer.css';

/**
 * DisclaimerPage component - Provides important disclaimers about FactVerify's limitations
 * 
 * Follows the elegant simplicity principles of Knuth, Ritchie, and Thompson
 */
const DisclaimerPage = () => {
  return (
    <div className="container">
      <Helmet>
        <title>Disclaimer - FactVerify</title>
        <meta name="description" content="Important disclaimers regarding FactVerify's fact-checking service, including limitations and considerations for users." />
      </Helmet>
      
      <main className="content-area">
        <section className="disclaimer-section">
          <h1>Disclaimer</h1>
          
          <div className="disclaimer-content">
            <h2>Evolving Information</h2>
            <p>
              The information landscape is constantly changing. Facts, especially those related to 
              recent events, scientific research, or developing situations, may evolve over time. 
              A claim that is verified as true or false today might receive a different assessment 
              in the future as new information emerges.
            </p>
            
            <h2>Context Dependency</h2>
            <p>
              The veracity of many claims depends heavily on context, interpretation, and specific 
              definitions of terms. FactVerify attempts to analyze claims within their most reasonable 
              context, but nuances in language and framing can affect our assessment.
            </p>
            
            <h2>Source Limitations</h2>
            <p>
              Our fact-checking process relies on information available online. While we strive to 
              find reliable sources, we cannot guarantee that all sources are completely accurate or 
              free from bias. We encourage users to review the provided sources themselves.
            </p>
            
            <h2>AI Limitations</h2>
            <p>
              FactVerify uses artificial intelligence to analyze information. While our AI systems 
              are sophisticated, they have inherent limitations in understanding context, detecting 
              satire, or evaluating highly specialized or technical claims.
            </p>
            
            <h2>Not Legal or Professional Advice</h2>
            <p>
              FactVerify's assessments should not be considered legal, medical, financial, or 
              professional advice. For important decisions, please consult with qualified professionals 
              in the relevant field.
            </p>
            
            <h2>Continuous Improvement</h2>
            <p>
              We are constantly working to improve our fact-checking capabilities. This means our 
              methods, algorithms, and assessment criteria may change over time, potentially leading 
              to different results for similar claims.
            </p>
            
            <h2>User Responsibility</h2>
            <p>
              While FactVerify aims to provide accurate information, users are ultimately responsible 
              for their own critical thinking and decision-making. We encourage users to:
            </p>
            <ul>
              <li>Review the sources we provide</li>
              <li>Consider multiple perspectives on complex issues</li>
              <li>Recognize that even verified facts can have different interpretations</li>
              <li>Understand that real-world scenarios often involve nuance that automated systems may not fully capture</li>
            </ul>
            
            <h2>Feedback</h2>
            <p>
              We value your feedback on our fact-checking results. If you believe an assessment is 
              incorrect or incomplete, please let us know so we can continue to improve our service.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DisclaimerPage;

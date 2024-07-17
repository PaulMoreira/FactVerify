import React, { useState } from 'react';

const PolicyComparison = ({ bidenIdeas, trumpIdeas }) => {
  const [selectedPolicy, setSelectedPolicy] = useState('');

  const policyAreas = [
    { value: '', label: 'Select a policy area' },
    { value: 'economy', label: 'Economy and Jobs' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'climate', label: 'Climate and Environment' },
    { value: 'immigration', label: 'Immigration' },
  ];

  const getIdeasForPolicy = (ideas, policyArea) => {
    return ideas.find(idea => idea.title.toLowerCase().includes(policyArea)) || { content: ['No specific policy found.'] };
  };

  return (
    <div className="policy-comparison">
      <h2>Compare Policies</h2>
      <select 
        value={selectedPolicy} 
        onChange={(e) => setSelectedPolicy(e.target.value)}
        className="policy-selector"
      >
        {policyAreas.map(policy => (
          <option key={policy.value} value={policy.value}>{policy.label}</option>
        ))}
      </select>
      {selectedPolicy && (
        <div className="comparison-content">
          <div className="candidate-policy">
            <h3>Joe Biden</h3>
            <ul>
              {getIdeasForPolicy(bidenIdeas, selectedPolicy).content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="candidate-policy">
            <h3>Donald Trump</h3>
            <ul>
              {getIdeasForPolicy(trumpIdeas, selectedPolicy).content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyComparison;
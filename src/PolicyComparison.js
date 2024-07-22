import React, { useState } from 'react';
import axios from 'axios';

const PolicyComparison = ({ harrisIdeas, trumpIdeas }) => {
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [scenarios, setScenarios] = useState({ harris: '', trump: '' });
  const [loading, setLoading] = useState({ harris: false, trump: false });

  const policyAreas = [
    { value: '', label: 'Select a policy area' },
    { value: 'economy', label: 'Economy and Jobs' },
    { value: 'immigration', label: 'Immigration' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'climate', label: 'Climate and Environment' },
    { value: 'law_and_order', label: 'Law and Order' },
    { value: 'democracy', label: 'Democracy' },
    { value: 'abortion', label: 'Abortion Rights' },
  ];

  const getIdeasForPolicy = (ideas, policyArea) => {
    return ideas.find(idea => idea.title.toLowerCase().includes(policyArea)) || { content: ['No specific policy found.'] };
  };

  const generateScenario = async (candidateName, policyArea) => {
    const candidate = candidateName.toLowerCase();
    setLoading(prev => ({ ...prev, [candidate]: true }));
    try {
      const response = await axios.post(`/api/generate-example`, {
        idea: policyArea,
        candidateName: candidateName
      });
      setScenarios(prev => ({
        ...prev,
        [candidate]: response.data.example
      }));
    } catch (error) {
      console.error('Error generating scenario:', error);
      setScenarios(prev => ({
        ...prev,
        [candidate]: 'Failed to generate scenario. Please try again.'
      }));
    }
    setLoading(prev => ({ ...prev, [candidate]: false }));
  };

  const renderCandidatePolicy = (candidateName, ideas) => {
    const candidate = candidateName.toLowerCase();
    return (
      <div className="candidate-policy">
        <h3>{candidateName}</h3>
        <ul>
          {getIdeasForPolicy(ideas, selectedPolicy).content.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
        <button 
          onClick={() => generateScenario(candidateName, selectedPolicy)}
          disabled={loading[candidate]}
        >
          {loading[candidate] ? 'Generating...' : 'Explore Scenario'}
        </button>
        {loading[candidate] && (
          <div className="scenario-example">
            <h4>Generating scenario...</h4>
          </div>
        )}
        {!loading[candidate] && scenarios[candidate] && (
          <div className="scenario-example">
            <h4>Scenario Example:</h4>
            <p>{scenarios[candidate]}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="policy-comparison">
      <h2>Compare Policies</h2>
      <select 
        value={selectedPolicy} 
        onChange={(e) => {
          setSelectedPolicy(e.target.value);
          setScenarios({ harris: '', trump: '' });
        }}
        className="policy-selector"
      >
        {policyAreas.map(policy => (
          <option key={policy.value} value={policy.value}>{policy.label}</option>
        ))}
      </select>
      {selectedPolicy && (
        <div className="comparison-content">
          {renderCandidatePolicy('Kamala Harris', harrisIdeas)}
          {renderCandidatePolicy('Donald Trump', trumpIdeas)}
        </div>
      )}
    </div>
  );
};

export default PolicyComparison;
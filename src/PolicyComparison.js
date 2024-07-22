import React, { useState } from 'react';
import axios from 'axios';

const PolicyComparison = ({ harrisIdeas, trumpIdeas }) => {
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [harrisScenario, setHarrisScenario] = useState('');
  const [trumpScenario, setTrumpScenario] = useState('');
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
      if (candidate === 'harris') {
        setHarrisScenario(response.data.example);
      } else {
        setTrumpScenario(response.data.example);
      }
    } catch (error) {
      console.error('Error generating scenario:', error);
      if (candidate === 'harris') {
        setHarrisScenario('Failed to generate scenario. Please try again.');
      } else {
        setTrumpScenario('Failed to generate scenario. Please try again.');
      }
    }
    setLoading(prev => ({ ...prev, [candidate]: false }));
  };

  return (
    <div className="policy-comparison">
      <h2>Compare Policies</h2>
      <select 
        value={selectedPolicy} 
        onChange={(e) => {
          setSelectedPolicy(e.target.value);
          setHarrisScenario('');
          setTrumpScenario('');
        }}
        className="policy-selector"
      >
        {policyAreas.map(policy => (
          <option key={policy.value} value={policy.value}>{policy.label}</option>
        ))}
      </select>
      {selectedPolicy && (
        <div className="comparison-content">
          <div className="candidate-policy">
            <h3>Kamala Harris</h3>
            <ul>
              {getIdeasForPolicy(harrisIdeas, selectedPolicy).content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
            <button 
              onClick={() => generateScenario('Kamala Harris', selectedPolicy)}
              disabled={loading.harris}
            >
              {loading.harris ? 'Generating...' : 'Explore Scenario'}
            </button>
            {loading.harris && (
              <div className="scenario-example">
                <h4>Generating scenario...</h4>
              </div>
            )}
            {!loading.harris && harrisScenario && (
              <div className="scenario-example">
                <h4>Scenario Example:</h4>
                <p>{harrisScenario}</p>
              </div>
            )}
          </div>
          <div className="candidate-policy">
            <h3>Donald Trump</h3>
            <ul>
              {getIdeasForPolicy(trumpIdeas, selectedPolicy).content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
            <button 
              onClick={() => generateScenario('Donald Trump', selectedPolicy)}
              disabled={loading.trump}
            >
              {loading.trump ? 'Generating...' : 'Explore Scenario'}
            </button>
            {loading.trump && (
              <div className="scenario-example">
                <h4>Generating scenario...</h4>
              </div>
            )}
            {!loading.trump && trumpScenario && (
              <div className="scenario-example">
                <h4>Scenario Example:</h4>
                <p>{trumpScenario}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyComparison;
import React, { useState } from 'react';
import axios from 'axios';

const PolicyComparison = ({ bidenIdeas, trumpIdeas }) => {
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [bidenScenario, setBidenScenario] = useState('');
  const [trumpScenario, setTrumpScenario] = useState('');
  const [loading, setLoading] = useState({ biden: false, trump: false });

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

  const generateScenario = async (candidateName, policyArea) => {
    setLoading(prev => ({ ...prev, [candidateName.toLowerCase()]: true }));
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/server/generate-example`, {
        idea: policyArea,
        candidateName: candidateName
      });
      if (candidateName === 'Joe Biden') {
        setBidenScenario(response.data.example);
      } else {
        setTrumpScenario(response.data.example);
      }
    } catch (error) {
      console.error('Error generating scenario:', error);
    }
    setLoading(prev => ({ ...prev, [candidateName.toLowerCase()]: false }));
  };

  return (
    <div className="policy-comparison">
      <h2>Compare Policies</h2>
      <select 
        value={selectedPolicy} 
        onChange={(e) => {
          setSelectedPolicy(e.target.value);
          setBidenScenario('');
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
            <h3>Joe Biden</h3>
            <ul>
              {getIdeasForPolicy(bidenIdeas, selectedPolicy).content.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
            <button 
              onClick={() => generateScenario('Joe Biden', selectedPolicy)}
              disabled={loading.biden}
            >
              {loading.biden ? 'Generating...' : 'Explore Scenario'}
            </button>
            {bidenScenario && (
              <div className="scenario-example">
                <h4>Scenario Example:</h4>
                <p>{bidenScenario}</p>
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
            {trumpScenario && (
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
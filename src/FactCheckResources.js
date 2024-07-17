import React from 'react';

const factCheckingSites = [
  { name: 'FactCheck.org', url: 'https://www.factcheck.org/' },
  { name: 'PolitiFact', url: 'https://www.politifact.com/' },
  { name: 'Snopes', url: 'https://www.snopes.com/' },
  { name: 'The Washington Post Fact Checker', url: 'https://www.washingtonpost.com/news/fact-checker/' },
  { name: 'Reuters Fact Check', url: 'https://www.reuters.com/fact-check/' },
  { name: 'AP Fact Check', url: 'https://apnews.com/APFactCheck' },
  { name: 'Full Fact', url: 'https://fullfact.org/' },
  { name: 'Hoax-Slayer', url: 'https://www.hoax-slayer.net/' },
];

const FactCheckResources = () => {
  return (
    <div className="fact-check-resources">
      <h2>Fact-Checking Resources</h2>
      <p>Verify claims and get more context using these trusted fact-checking websites:</p>
      <ul>
        {factCheckingSites.map((site, index) => (
          <li key={index}>
            <a href={site.url} target="_blank" rel="noopener noreferrer">{site.name}</a>
          </li>
        ))}
      </ul>
      <p>Remember to cross-reference multiple sources for the most accurate information.</p>
    </div>
  );
};

export default FactCheckResources;
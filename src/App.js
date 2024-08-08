import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import Navigation from './Navigation';
import PolicyComparison from './PolicyComparison';
import FactCheckResources from './FactCheckResources';
import VoterResources from './VoterResources';
import ElectionInsightsPage from './ElectionInsightsPage';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import axios from 'axios';
import CountdownTimer from './CountdownTimer';
import WhatsNewSection from './WhatsNewSection';
import FullArticle from './FullArticle';

const CandidateIdea = ({ title, content, source, candidateName }) => {
  const [example, setExample] = useState('');
  const [loading, setLoading] = useState(false);

  const generateExample = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`/api/generate-example`, { 
        idea: title, 
        candidateName: candidateName 
      });
      setExample(response.data.example);
    } catch (error) {
      console.error('Error generating example:', error);
    }
    setLoading(false);
  };

  return (
    <div className="idea">
      <h3>{title}</h3>
      <ul>
        {content.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      <a href={source} target="_blank" rel="noopener noreferrer">Source</a>
      <button onClick={generateExample} disabled={loading}>
        {loading ? 'Generating...' : 'Explore Scenario'}
      </button>
      {example && (
        <div className="ai-example">
          <h4>Scenario Example:</h4>
          <p>{example}</p>
        </div>
      )}
    </div>
  );
};

const Candidate = ({ name, image, ideas, party }) => (
  <div className={`candidate ${party}`}>
    <h2>{name}</h2>
    <img src={image} alt={name} className="candidate-image" />
    <div className="ideas">
      {ideas.map((idea, index) => (
        <CandidateIdea key={index} {...idea} candidateName={name} />
      ))}
    </div>
  </div>
);

const HomePage = ({ harrisIdeas, trumpIdeas }) => (
  <>
    <div className="introduction">
      <h2>Welcome to the 2024 Presidential Election Information Hub</h2>
      <p>
      Let's move beyond party rhetoric and focus on the candidates' concrete 
      ideas and plans for after the election. Your vote should be based on substantive policies, 
      not campaign slogans. Be cautious of information from social media, as it can often be inaccurate or misleading. 
      Instead, take the time to understand what each candidate is truly offering. This comparison aims to provide a clear, 
      fact-based overview of both candidates' platforms to help you make an informed decision.
      </p>
    </div>
    <div className="content-wrapper">
      <main className="main-content">
        <PolicyComparison harrisIdeas={harrisIdeas} trumpIdeas={trumpIdeas} />
        <div className="candidates-container">
          <Candidate name="Kamala Harris" image="harris.jpg" ideas={harrisIdeas} party="democrat" />
          <Candidate name="Donald Trump" image="trump.jpg" ideas={trumpIdeas} party="republican" />
        </div>
        <FactCheckResources />
        <VoterResources />
      </main>
      <aside className="sidebar">
        <CountdownTimer />
        <WhatsNewSection />
      </aside>
    </div>
  </>
);

const App = () => {
  const harrisIdeas = [
    {
      title: "Economy and Jobs",
      content: [
        "Introduce the LIFT Act, providing up to $3,000 per tax filer to increase after-tax income for low- and middle-income families.",
        "Support the American Jobs Plan, investing $180 billion in research, development, and manufacturing to boost American innovation and competitiveness.",
      ],
      source: "https://www.marketplace.org/2023/08/01/kamala-harris-economic-policy/"
    },
    {
      title: "Immigration",
      content: [
        "Advocate for comprehensive immigration reform with a pathway to citizenship for undocumented immigrants.",
        "Support reforms to ensure fair and efficient processing of asylum claims.",
        "Strengthen and protect the DACA program for undocumented youth brought to the U.S. as children.",
      ],
      source: "https://www.nbcnews.com/politics/2020-election/kamala-harris-immigration-plan-aims-protect-dreamers-expand-daca-n1057806"
    },
    {
      title: "Healthcare",
      content: [
        "Endorse a modified version of Medicare for All, offering Americans the choice between regulated private health insurance or a public plan.",
        "Support measures to strengthen the nation's pandemic preparedness and response capabilities.",
      ],
      source: "https://www.marketplace.org/2023/08/01/kamala-harris-healthcare-policy/"
    },
    {
      title: "Education",
      content: [
        "Advocate for universal pre-kindergarten to ensure every child has access to early education.",
        "Support policies to make community college tuition-free and reduce costs for four-year public colleges for families earning less than $125,000 annually.",
      ],
      source: "https://thehill.com/homenews/campaign/3964291-where-kamala-harris-stands-on-5-major-policy-issues/"
    },
    {
      title: "Climate and Environment",
      content: [
        "Support the Green New Deal to address climate change, aiming for net-zero carbon emissions by 2050.",
        "Promote investments in clean energy technologies and infrastructure to reduce dependence on fossil fuels and create green jobs.",
      ],
      source: "https://www.vox.com/2023/6/15/23757419/kamala-harris-climate-change-policy-explained"
    },
    {
      title: "Law and Order",
      content: [
        "Push for comprehensive criminal justice reform, including eliminating cash bail, decriminalizing marijuana, and expunging marijuana-related convictions.",
        "Advocate for measures to improve police accountability and transparency, such as establishing a national database of police misconduct.",
      ],
      source: "https://www.politico.com/news/2023/04/20/kamala-harris-criminal-justice-reform-00092847"
    },
    {
      title: "Democracy",
      content: [
        "Support the John Lewis Voting Rights Advancement Act to protect and expand voting rights.",
        "Advocate for reforms to reduce the influence of money in politics, including overturning the Citizens United decision.",
      ],
      source: "https://www.npr.org/2023/07/14/1186421035/kamala-harris-voting-rights"
    },
    {
      title: "Abortion Rights",
      content: [
        "Strongly support the protection of reproductive rights, including the right to access safe and legal abortions.",
        "Advocate for federal legislation to codify the protections of Roe v. Wade and prevent states from enacting restrictive abortion laws.",
      ],
      source: "https://www.plannedparenthoodaction.org/elections/candidates/kamala-harris"
    },
  ];

  const trumpIdeas = [
    {
      title: "Economy and Jobs",
      content: [
        "Propose 'Freedom Cities': Build new cities on federal land to boost innovation and economic growth.",
        "Manufacturing: Bring back manufacturing jobs through protectionist trade policies and tax incentives.",
        "Tax Plan: Make individual income tax cuts from the 2017 Tax Cuts and Jobs Act permanent, consider replacing personal income taxes with increased tariffs, and exempt tips from income taxes.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Immigration",
      content: [
        "Mass Deportations: Resume large-scale deportations and end birthright citizenship.",
        "Border Security: Continue construction of the border wall and increase border security technology.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Healthcare",
      content: [
        "Repeal Obamacare: Replace the Affordable Care Act with a system focused on private healthcare options.",
        "Prescription Drug Costs: Lower prices through importation and increased competition.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Education",
      content: [
        "School Choice: Expand programs including vouchers for private schools.",
        "Curriculum Changes: Emphasize 'patriotic education' and remove critical race theory from curricula.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Climate and Environment",
      content: [
        "Energy Independence: Focus on increasing domestic energy production, including oil and gas.",
        "Environmental Deregulation: Roll back regulations to boost economic growth.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Law and Order",
      content: [
        "National Guard in Cities: Deploy to high-crime cities to restore order.",
        "Death Penalty for Drug Dealers: Advocate as part of the plan to combat the opioid crisis.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Democracy",
      content: [
        "Election Integrity: Push for voter ID laws and other measures to prevent election fraud.",
        "Campaign Finance Reform: Limit the influence of foreign money in U.S. elections.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
    {
      title: "Abortion Rights",
      content: [
        "Anti-Abortion Policies: Support federal restrictions on abortion, including potential nationwide bans on late-term abortions.",
      ],
      source: "https://ballotpedia.org/Donald_Trump_presidential_campaign,_2024"
    },
  ];

  return (
    <Router>
      <div className="app">
        <header>
          <div className="header-content">
            <img src="/og-image.jpg" alt="2024 Election Logo" className="logo" />
            <h1>2024 Presidential Election: Ideas & Plans</h1>
          </div>
        </header>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage harrisIdeas={harrisIdeas} trumpIdeas={trumpIdeas} />} />
          <Route path="/resources" element={<VoterResources />} />
          <Route path="/insights" element={<ElectionInsightsPage />} />
          <Route path="/insights/:articleId" element={<FullArticle />} />
        </Routes>
        <footer>
          <p>&copy; 2024 Election Facts. All rights reserved.</p>
          <p>Sources: Various, as linked in each section</p>
        </footer>
        <Analytics />
        <SpeedInsights/>
      </div>
    </Router>
  );
};

export default App;
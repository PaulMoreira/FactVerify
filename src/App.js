import React from 'react';
import './App.css';
import PolicyComparison from './PolicyComparison';
import FactCheckResources from './FactCheckResources';
import VoterResources from './VoterResources';
import { Analytics } from "@vercel/analytics/react"

const CandidateIdea = ({ title, content, source }) => (
  <div className="idea">
    <h3>{title}</h3>
    <ul>
      {content.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
    <a href={source} target="_blank" rel="noopener noreferrer">Source</a>
  </div>
);

const Candidate = ({ name, image, ideas, party }) => (
  <div className={`candidate ${party}`}>
    <h2>{name}</h2>
    <img src={image} alt={name} className="candidate-image" />
    <div className="ideas">
      {ideas.map((idea, index) => (
        <CandidateIdea key={index} {...idea} />
      ))}
    </div>
  </div>
);

const App = () => {
  const bidenIdeas = [
    {
      title: "Economy and Jobs",
      content: [
        "Build Back Better Plan: Creating jobs through clean energy investments, infrastructure improvements, and boosting American-made products.",
        "Bidenomics: Creating middle-class jobs, rejecting trickle-down economics, and significant investments through Infrastructure Investment and Jobs Act and Inflation Reduction Act."
      ],
      source: "https://www.whitehouse.gov/build-back-better"
    },
    {
      title: "Healthcare",
      content: [
        "Affordable Care Act Expansion: Strengthening ACA, reducing premiums, capping drug prices for seniors at $2,000 per year.",
        "Medicare at 60: Lowering the eligibility age for Medicare to 60."
      ],
      source: "https://www.whitehouse.gov/health-care"
    },
    {
      title: "Education",
      content: [
        "Universal Pre-K and Free College: Investing $1.9 trillion in universal pre-K and tuition-free public college for lower-income families.",
        "Support for Minority-Serving Institutions: Significant investments in HBCUs and other minority-serving institutions."
      ],
      source: "https://knowledge.wharton.upenn.edu/article/a-breakdown-of-the-biden-policy-platform-five-key-takeaways"
    },
    {
      title: "Climate and Environment",
      content: [
        "Clean Energy Initiatives: Investment in renewable energy sources and establishing a new Civilian Climate Corps.",
        "Environmental Justice: Delivering 40% of clean energy investment benefits to disadvantaged communities through Justice40 initiative."
      ],
      source: "https://www.whitehouse.gov/climate"
    },
    {
      title: "Democracy and Abortion Rights",
      content: [
        "Defending Democracy: Making protection of American democracy a central cause, particularly against false claims about the 2020 election.",
        "Abortion Access: Promising to restore Roe v. Wade and opposing restrictive court rulings."
      ],
      source: "https://en.wikipedia.org/wiki/Joe_Biden_2024_presidential_campaign"
    },
    {
      title: "Immigration",
      content: [
        "Reversing Trump Policies: Aim to reverse restrictive immigration actions like family separation policy and travel ban on majority-Muslim countries.",
        "DACA and Family Reunification: Reinstate DACA, increase refugee admissions, and create a process for certain noncitizen family members to apply for permanent residence.",
        "Border Security and Humanitarian Solutions: Implement executive actions on asylum, deploy law enforcement personnel, and establish multiagency reception centers near the border."
      ],
      source: "https://en.wikipedia.org/wiki/Immigration_policy_of_the_Joe_Biden_administration"
    }
  ];

  const trumpIdeas = [
    {
      title: "Economy and Jobs",
      content: [
        "'Freedom Cities': Propose building new cities on federal land to boost innovation and economic growth.",
        "Manufacturing: Bring back manufacturing jobs through protectionist trade policies and tax incentives."
      ],
      source: "https://en.wikipedia.org/wiki/Agenda_47"
    },
    {
      title: "Immigration",
      content: [
        "Mass Deportations: Resume large-scale deportations and end birthright citizenship.",
        "Border Security: Continue construction of the border wall and increase border security technology."
      ],
      source: "https://en.wikipedia.org/wiki/Agenda_47"
    },
    {
      title: "Healthcare",
      content: [
        "Repeal Obamacare: Replace Affordable Care Act with a system focused on private healthcare options.",
        "Prescription Drug Costs: Lower prices through importation and increased competition."
      ],
      source: "https://www.thelist.com/1104844/donald-trumps-top-policies-a-2024-presidential-election-guide/"
    },
    {
      title: "Education",
      content: [
        "School Choice: Expand programs including vouchers for private schools.",
        "Curriculum Changes: Emphasize 'patriotic education' and remove critical race theory from curricula."
      ],
      source: "https://www.thelist.com/1104844/donald-trumps-top-policies-a-2024-presidential-election-guide/"
    },
    {
      title: "Climate and Environment",
      content: [
        "Energy Independence: Focus on increasing domestic energy production, including oil and gas.",
        "Environmental Deregulation: Roll back regulations to boost economic growth."
      ],
      source: "https://en.wikipedia.org/wiki/Agenda_47"
    },
    {
      title: "Law and Order",
      content: [
        "National Guard in Cities: Deploy to high-crime cities to restore order.",
        "Death Penalty for Drug Dealers: Advocate as part of plan to combat the opioid crisis."
      ],
      source: "https://en.wikipedia.org/wiki/Agenda_47"
    }
  ];

  return (
    <div className="app">
      <header>
        <h1>2024 Presidential Election: Ideas & Plans</h1>
      </header>
      <div className="introduction">
        <p>
          Let's move beyond party rhetoric and focus on the candidates' concrete ideas and plans for after the election. 
          Your vote should be based on substantive policies, not campaign slogans. Be cautious of information from social 
          media, as it can often be inaccurate or misleading. Instead, take the time to understand what each candidate is 
          truly offering. This comparison aims to provide a clear, fact-based overview of both candidates' platforms to 
          help you make an informed decision.
        </p>
      </div>
      <PolicyComparison bidenIdeas={bidenIdeas} trumpIdeas={trumpIdeas} />
      <div className="content-wrapper">
        <div className="main-content">
          <div className="candidates-container">
            <Candidate name="Joe Biden" image="biden.jpg" ideas={bidenIdeas} party="democrat" />
            <Candidate name="Donald Trump" image="trump.jpg" ideas={trumpIdeas} party="republican" />
          </div>
        </div>
      </div>
      <div className="resources-wrapper">
        <FactCheckResources />
        <VoterResources />
        <Analytics />
      </div>
      <footer>
        <p>&copy; 2024 Election Facts. All rights reserved.</p>
        <p>Sources: Various, as linked in each section</p>
      </footer>
    </div>
  );
};

export default App;
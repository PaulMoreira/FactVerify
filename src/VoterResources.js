import React from 'react';

const VoterResources = () => {
  return (
    <div className="voter-resources">
      <h2>Voter Resources</h2>
      
      <section>
        <h3>Voter Registration</h3>
        <ul>
          <li>
            <strong>How to Register:</strong> Visit <a href="https://vote.gov" target="_blank" rel="noopener noreferrer">Vote.gov</a> to select your state or territory for specific registration instructions.
          </li>
          <li>
            <strong>Check Registration Status:</strong> Confirm your voter registration status at <a href="https://www.usa.gov/confirm-voter-registration" target="_blank" rel="noopener noreferrer">USA.gov - Confirm Your Voter Registration</a>.
          </li>
          <li>
            <strong>Registration Deadlines:</strong> Check your state's deadline at:
            <ul>
              <li><a href="https://ballotpedia.org/Voter_registration_deadlines,_2024" target="_blank" rel="noopener noreferrer">Ballotpedia - Voter Registration Deadlines</a></li>
              <li><a href="https://www.usa.gov/voter-registration-deadlines" target="_blank" rel="noopener noreferrer">USA.gov - Voter Registration Deadlines</a></li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <h3>Polling Locations</h3>
        <ul>
          <li>
            Find your polling location:
            <ul>
              <li><a href="https://www.usa.gov/election-office" target="_blank" rel="noopener noreferrer">Find My State or Local Election Office</a></li>
              <li><a href="https://www.usvotefoundation.org" target="_blank" rel="noopener noreferrer">US Vote Foundation</a></li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <h3>Key Election Dates</h3>
        <ul>
          <li>
            <strong>Election Day:</strong> The next presidential election will be on November 5, 2024.
            <br />
            <a href="https://www.usa.gov/election-dates" target="_blank" rel="noopener noreferrer">USA.gov - When to Vote</a>
          </li>
          <li>
            <strong>Early Voting and Absentee Voting:</strong> Learn about your state's options:
            <ul>
              <li><a href="https://www.usa.gov/early-voting" target="_blank" rel="noopener noreferrer">USA.gov - Early Voting</a></li>
              <li><a href="https://www.usa.gov/absentee-voting" target="_blank" rel="noopener noreferrer">USA.gov - Absentee Voting</a></li>
            </ul>
          </li>
        </ul>
      </section>

      <p className="reminder">Remember to check these resources regularly as information may be updated closer to the election date.</p>
    </div>
  );
};

export default VoterResources;
import React, { useState, useEffect } from 'react';

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({});

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date("2024-11-05") - +new Date();
      let timeLeft = {};

      if (difference > 0) {
        timeLeft = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        };
      }

      return timeLeft;
    };

    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  return (
    <div className="countdown-timer">
      <h2>Election Day Countdown</h2>
      <div className="timer">
        {Object.keys(timeLeft).length === 0 ? (
          <span>Election Day is here!</span>
        ) : (
          Object.entries(timeLeft).map(([unit, value]) => (
            <div key={unit} className="time-unit">
              <span className="time-value">{value}</span>
              <span className="time-label">{unit}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CountdownTimer;
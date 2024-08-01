import React, { useState, useEffect } from 'react';

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({});

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date("2024-11-05") - +new Date();
      let timeLeft = {};

      if (difference > 0) {
        timeLeft = {
          d: Math.floor(difference / (1000 * 60 * 60 * 24)),
          h: Math.floor((difference / (1000 * 60 * 60)) % 24),
          m: Math.floor((difference / 1000 / 60) % 60),
          s: Math.floor((difference / 1000) % 60)
        };
      }

      return timeLeft;
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="countdown-timer">
      <h2>Election Day Countdown</h2>
      <div className="timer">
        {Object.entries(timeLeft).length === 0 ? (
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
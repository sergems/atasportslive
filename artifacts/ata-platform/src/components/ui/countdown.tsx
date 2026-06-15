import React, { useEffect, useState } from 'react';

export function Countdown({ seconds, className }: { seconds: number; className?: string }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  if (timeLeft <= 0) {
    return <span className={className}>LIVE</span>;
  }

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;

  return (
    <span className={className}>
      {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
}

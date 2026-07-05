import React, { useEffect, useState } from 'react';

function calcSecondsLeft(startTime: string): number {
  return Math.max(0, Math.floor((new Date(startTime).getTime() - Date.now()) / 1000));
}

export function Countdown({ startTime, className }: { startTime: string; className?: string }) {
  const [timeLeft, setTimeLeft] = useState(() => calcSecondsLeft(startTime));

  useEffect(() => {
    setTimeLeft(calcSecondsLeft(startTime));
    const interval = setInterval(() => {
      setTimeLeft(calcSecondsLeft(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

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

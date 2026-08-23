import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../../../components/MotionIcons';

/**
 * Countdown
 * Displays a server-authoritative or local animated countdown ring and digital timer
 * tailored to the HistoFacts parchment aesthetic.
 */
export default function Countdown({
  seconds = 20,
  maxSeconds = 20,
  serverAuthoritative = false,
  onExpire,
  size = 'md',
  showLabel = true,
  className = '',
}) {
  const [localSeconds, setLocalSeconds] = useState(seconds);

  useEffect(() => {
    if (serverAuthoritative) {
      setLocalSeconds(seconds);
    }
  }, [seconds, serverAuthoritative]);

  useEffect(() => {
    if (serverAuthoritative) return;

    setLocalSeconds(seconds);
    const interval = setInterval(() => {
      setLocalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, serverAuthoritative, onExpire]);

  const currentVal = serverAuthoritative ? seconds : localSeconds;
  const progressRatio = Math.max(0, Math.min(1, currentVal / (maxSeconds || 20)));

  const isCritical = currentVal <= 5;
  const isWarning = currentVal <= 10 && currentVal > 5;

  const colorClass = isCritical
    ? 'text-rose-600 stroke-rose-600'
    : isWarning
    ? 'text-amber-700 stroke-amber-600'
    : 'text-histo-copper stroke-histo-copper';

  const bgRingClass = 'stroke-histo-dark/10';

  const radius = size === 'sm' ? 14 : size === 'lg' ? 26 : 20;
  const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 4.5 : 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const dimension = (radius + strokeWidth) * 2;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? `${m}:` : ''}${String(s).padStart(m > 0 ? 2 : 1, '0')}s`;
  };

  return (
    <div className={`inline-flex items-center gap-2 font-ui ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: dimension, height: dimension }}>
        <svg
          className="transform -rotate-90"
          width={dimension}
          height={dimension}
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            className={bgRingClass}
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            className={colorClass}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </svg>
        <span className={`absolute text-[11px] font-bold font-mono ${colorClass}`}>
          {currentVal}
        </span>
      </div>

      {showLabel && (
        <div className="flex items-center gap-1 text-xs font-semibold text-histo-dark">
          <ClockIcon className={`h-3.5 w-3.5 ${colorClass}`} />
          <span>{formatTime(currentVal)}</span>
        </div>
      )}
    </div>
  );
}
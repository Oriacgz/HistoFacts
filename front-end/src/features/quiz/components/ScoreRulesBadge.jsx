import React from 'react';
import { ShieldIcon, BulbIcon } from '../../../components/MotionIcons';

/**
 * ScoreRulesBadge
 * Small inline badge showing scoring rules (+2/-X) next to start buttons
 * and difficulty selectors in the HistoFacts parchment & copper palette.
 */
export default function ScoreRulesBadge({
  correct = 2,
  wrong = 0,
  className = '',
  showIcon = true,
  size = 'sm',
}) {
  const isNegative = wrong !== 0;
  const wrongLabel = wrong > 0 ? `-${wrong}` : `${wrong}`;

  const sizeClasses = size === 'xs' 
    ? 'px-2 py-0.5 text-[11px] gap-1' 
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <div
      className={`inline-flex items-center rounded-full font-ui font-semibold border shadow-xs transition-colors ${
        isNegative
          ? 'bg-amber-500/15 border-amber-600/30 text-amber-900'
          : 'bg-emerald-500/15 border-emerald-600/30 text-emerald-900'
      } ${sizeClasses} ${className}`}
      title={`Scoring Rule: +${correct} for correct answer, ${wrongLabel} for wrong answer`}
    >
      {showIcon && (
        isNegative ? (
          <ShieldIcon className="h-3 w-3 shrink-0 text-amber-700" />
        ) : (
          <BulbIcon className="h-3 w-3 shrink-0 text-emerald-700" />
        )
      )}
      <span className="text-emerald-700 font-bold">+{correct}</span>
      <span className="text-histo-ink/30">/</span>
      <span className={isNegative ? 'text-rose-700 font-bold' : 'text-histo-ink/60'}>
        {wrongLabel}
      </span>
    </div>
  );
}
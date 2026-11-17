import { useEffect, useId, useState } from 'react';
const MESSAGES = [
  'Opening your tracker…',
  'Getting your space ready…',
  'Your tracker is ready.',
];
export const LOADING_DURATION = 3000;
export function SeiteLoader({ onReady, onCancel }) {
  const [stage, setStage] = useState(0);
  const id = useId().replaceAll(':', '');
  useEffect(() => {
    const secondStage = setTimeout(() => setStage(1), 1000);
    const finalStage = setTimeout(() => setStage(2), 2300);
    const finish = setTimeout(onReady, LOADING_DURATION);
    return () => {
      clearTimeout(secondStage);
      clearTimeout(finalStage);
      clearTimeout(finish);
    };
  }, [onReady]);
  return (
    <main className="loading-page">
      <div className="loader-halo" aria-hidden="true" />
      <div className="liquid-logo" aria-hidden="true">
        <svg viewBox="0 0 180 210">
          <defs>
            <clipPath id={`mark-${id}`}>
              <path d="M23 190V78C23 35 47 16 87 16H157V128C157 171 133 190 93 190Z" />
            </clipPath>
            <linearGradient id={`liquid-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#ff5168" />
              <stop offset="1" stopColor="#ff9c50" />
            </linearGradient>
          </defs>
          <path
            d="M23 190V78C23 35 47 16 87 16H157V128C157 171 133 190 93 190Z"
            fill="#ffe9dc"
          />
          <g clipPath={`url(#mark-${id})`}>
            <g className="liquid-rise">
              <g className="liquid-wave-back">
                <path
                  d="M-180 10Q-135-10-90 10T0 10T90 10T180 10T270 10T360 10V250H-180Z"
                  fill="#ffb48d"
                />
              </g>
              <g className="liquid-wave-front">
                <path
                  d="M-180 10Q-135 28-90 10T0 10T90 10T180 10T270 10T360 10V250H-180Z"
                  fill={`url(#liquid-${id})`}
                />
              </g>
            </g>
            <circle className="liquid-bubble bubble-one" cx="64" cy="158" r="5" />
            <circle className="liquid-bubble bubble-two" cx="117" cy="175" r="3" />
          </g>
        </svg>
        <span className="loader-spark">✧</span>
      </div>
      <div className="loader-wordmark">
        seite<span>.</span>
      </div>
      <div className="loader-copy" role="status" aria-live="polite" aria-atomic="true">
        <h1 key={stage}>{MESSAGES[stage]}</h1>
      </div>
      <button className="plain-link loader-skip" onClick={onReady}>
        Open tracker now →
      </button>
      <button className="plain-link loader-back" onClick={onCancel}>
        ← Back
      </button>
      <span className="loader-footnote">
        Opening your local preview. No email connection is being made.
      </span>
    </main>
  );
}

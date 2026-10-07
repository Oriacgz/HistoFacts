import { useEffect, useState } from 'react';

export default function QuizGenerationProgress({ sourceType = 'topic' }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="status" aria-live="polite" className="mt-4 rounded border border-histo-copper/30 bg-white p-4 text-left">
      <p className="font-ui text-sm font-bold text-histo-dark">
        {sourceType === 'pdf' ? 'Reading your PDF…' : 'Preparing your history quiz…'}
      </p>
      <div aria-hidden="true" className="flex gap-1.5 my-3">
        {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 rounded-full bg-histo-copper animate-bounce motion-reduce:animate-none" style={{ animationDelay: `${dot * 150}ms` }} />)}
      </div>
      <p className="text-xs font-body text-histo-ink/70">
        {sourceType === 'pdf' ? 'Extracting readable text and preparing 10 questions.' : 'Generating and checking 10 questions and their answer choices.'}
        {' '}The local model may take a few minutes. You can stay on this screen.
      </p>
      <p className="mt-2 text-xs font-ui text-histo-ink/60">Elapsed: {elapsed}s</p>
    </div>
  );
}

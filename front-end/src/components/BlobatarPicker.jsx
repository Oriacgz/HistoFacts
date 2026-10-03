import { useState } from 'react';
import { Blobatar } from '@blobatar/react';
import { Shuffle } from 'lucide-react';

// Distinct-but-deterministic candidates: an index appended to a base string.
// "Show more options" reseeds from a fresh random base for an entirely new batch.
function generateCandidateSeeds(base, count = 15) {
  return Array.from({ length: count }, (_, i) => `${base}-${i}`);
}

export default function BlobatarPicker({ baseSeed, currentSeed, onSelect, disabled = false }) {
  const [candidates, setCandidates] = useState(() => generateCandidateSeeds(baseSeed));

  const shuffle = () => setCandidates(generateCandidateSeeds(crypto.randomUUID()));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {candidates.map((seed) => (
          <button
            key={seed}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(seed)}
            title={seed}
            className={`flex items-center justify-center rounded-full transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              seed === currentSeed ? 'ring-2 ring-amber-400' : ''
            }`}
          >
            <Blobatar name={seed} size={64} animate="hover" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={shuffle}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-histo-paper font-ui text-xs font-semibold border border-white/20 transition-all cursor-pointer disabled:opacity-50"
      >
        <Shuffle className="h-3.5 w-3.5" />
        <span>Show more options</span>
      </button>
    </div>
  );
}

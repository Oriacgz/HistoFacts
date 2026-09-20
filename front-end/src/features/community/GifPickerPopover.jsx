import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { searchGifsApi } from '../../api/social';

// Shared Tenor GIF search — the single GIF integration in the app (community feed, chat).
// The Tenor key lives server-side; the backend proxies the search and 503s when unset.
export default function GifPickerPopover({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim() || 'history';
    const timer = setTimeout(async () => {
      setStatus('loading');
      setError(null);
      try {
        const results = await searchGifsApi(term);
        setGifs(results);
        setStatus('done');
      } catch (err) {
        setStatus('error');
        setError(err?.message || 'GIF search failed');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-30 mb-2 w-[340px] rounded-xl border border-histo-dark/15 bg-white shadow-deep p-2"
    >
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-histo-ink/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Tenor GIFs..."
          autoFocus
          className="w-full pl-8 pr-3 py-1.5 bg-histo-paper/50 border border-histo-dark/15 rounded-lg text-xs font-body outline-none focus:border-histo-copper"
        />
      </div>

      {status === 'error' ? (
        <p className="px-1 py-3 text-[11px] font-ui text-histo-ink/60">{error}</p>
      ) : status === 'loading' ? (
        <div className="py-6 text-center text-[11px] font-ui text-histo-ink/50">Searching GIFs...</div>
      ) : (
        <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => onSelect(gif.url)}
              className="rounded-lg overflow-hidden border border-histo-dark/10 hover:border-histo-copper transition-colors cursor-pointer"
            >
              <img src={gif.preview_url} alt="GIF result" loading="lazy" className="w-full h-24 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

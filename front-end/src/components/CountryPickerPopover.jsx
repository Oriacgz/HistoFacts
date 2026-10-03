import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check } from 'lucide-react';
import countries from 'country-list';
import { getCountryFlag } from '../utils/historyTaxonomy';

// Curated list of popular historical countries for quick suggestion chips
const POPULAR_HISTORICAL_COUNTRIES = [
  { code: 'JP', name: 'Japan' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'CN', name: 'China' },
  { code: 'EG', name: 'Egypt' },
  { code: 'GR', name: 'Greece' },
  { code: 'RU', name: 'Russia' },
  { code: 'ES', name: 'Spain' },
  { code: 'TR', name: 'Turkey' },
];

/**
 * Lightweight, searchable country picker popover for adding historical country scopes.
 *
 * @param {boolean} isOpen - Whether popover is visible
 * @param {Function} onClose - Close callback
 * @param {Function} onSelectCountry - Selection callback passing { code, name }
 * @param {string[]} existingScopeNames - Array of already-added country scope names
 */
export default function CountryPickerPopover({
  isOpen,
  onClose,
  onSelectCountry,
  existingScopeNames = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize existing scope names for case-insensitive duplicate checking
  const existingSet = useMemo(() => {
    return new Set(existingScopeNames.map((s) => (s || '').trim().toLowerCase()));
  }, [existingScopeNames]);

  // Clean and prepare list of all countries from country-list
  const allCountries = useMemo(() => {
    try {
      const raw = countries.getData() || [];
      return raw
        .map((c) => ({
          code: c.code,
          name: (c.name || '')
            .replace(/\s*\(the\)$/i, '')
            .replace(/,\s*Province of/i, '')
            .trim(),
        }))
        .filter((c) => c.name && c.code)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return POPULAR_HISTORICAL_COUNTRIES;
    }
  }, []);

  // Filter countries according to live search query
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [allCountries, searchQuery]);

  // Quick suggestion chips: popular nations not yet added
  const suggestions = useMemo(() => {
    return POPULAR_HISTORICAL_COUNTRIES.filter(
      (c) => !existingSet.has(c.name.toLowerCase())
    ).slice(0, 6);
  }, [existingSet]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSearchQuery('');
    }
  }

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Click-outside listener & ESC key listener
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] z-50 bg-white border border-histo-dark/20 rounded-[6px] shadow-2xl overflow-hidden flex flex-col font-ui"
          style={{ maxHeight: '420px' }}
        >
          {/* Popover Header */}
          <div className="px-3.5 pt-3 pb-2 border-b border-histo-dark/10 flex items-center justify-between bg-histo-paper/60">
            <div>
              <h4 className="text-xs font-bold text-histo-dark uppercase tracking-wider">
                Explore another country
              </h4>
              <p className="text-[11px] text-histo-ink/65 leading-tight">
                Add a country to your historical calendar scopes
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-histo-ink/50 hover:text-histo-dark hover:bg-black/5 transition-colors cursor-pointer"
              title="Close country picker"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-histo-dark/10 bg-white">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-histo-ink/40 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country (e.g. Japan, France)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-histo-paper/40 border border-histo-dark/15 rounded-[4px] text-histo-dark placeholder:text-histo-ink/40 focus:outline-none focus:border-histo-copper focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-histo-ink/40 hover:text-histo-dark cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Suggestions Chips */}
            {!searchQuery && suggestions.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-histo-dark/5">
                <span className="block text-[10px] uppercase font-semibold text-histo-ink/50 tracking-wider mb-1">
                  Popular Scopes
                </span>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        onSelectCountry(c);
                        onClose();
                      }}
                      className="px-2 py-0.5 rounded-[3px] bg-histo-paper/80 hover:bg-histo-copper hover:text-white border border-histo-dark/10 text-[11px] text-histo-dark flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{getCountryFlag(c.code)}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scrollable Country List */}
          <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-histo-dark/5 scrollbar-thin">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-histo-ink/50 italic">
                No matching country found
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isAlreadyAdded = existingSet.has(c.name.toLowerCase());
                return (
                  <button
                    key={c.code}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => {
                      if (!isAlreadyAdded) {
                        onSelectCountry(c);
                        onClose();
                      }
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isAlreadyAdded
                        ? 'opacity-50 bg-black/[0.02] cursor-not-allowed'
                        : 'hover:bg-histo-paper/80 active:bg-histo-paper'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-histo-dark">
                      <span className="text-base">{getCountryFlag(c.code)}</span>
                      <span className="font-medium">{c.name}</span>
                    </span>
                    {isAlreadyAdded ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                        <Check className="h-2.5 w-2.5" /> Added
                      </span>
                    ) : (
                      <span className="text-[10px] text-histo-ink/40 font-mono">
                        {c.code}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

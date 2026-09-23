import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Bookmark,
  Calendar,
  Crown,
  Search,
  Clock,
  Sparkles,
  Share2,
  X,
  ExternalLink,
  RotateCcw,
  Shuffle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getTodayEventsApi,
  getEventsByDateApi,
  searchEventsApi,
  addBookmarkApi,
  removeBookmarkApi,
  getMyBookmarksApi,
} from '../api/history';
import {
  SCOPES,
  INDIA_CATEGORIES,
  WORLD_CATEGORIES,
  detectEventScope,
  classifyEventCategory,
  deriveShortDescription,
  getCategoryBadgeClass,
} from '../utils/historyTaxonomy';

// Famous landmark dates for "Random Historical Date" explorer
const HISTORICAL_MYSTERY_DATES = [
  { month: 7, day: 20, name: 'Apollo 11 Moon Landing (1969)' },
  { month: 7, day: 14, name: 'Storming of the Bastille (1789)' },
  { month: 11, day: 9, name: 'Fall of the Berlin Wall (1989)' },
  { month: 8, day: 15, name: 'Indian Independence Day (1947)' },
  { month: 6, day: 6, name: 'D-Day Normandy Landings (1944)' },
  { month: 10, day: 24, name: 'United Nations Founded (1945)' },
  { month: 11, day: 4, name: "Discovery of King Tut's Tomb (1922)" },
  { month: 12, day: 10, name: 'First Nobel Prizes Awarded (1901)' },
];

// Fallback seed when backend is starting or offline (comprising both INDIA and WORLD scopes)
const newsSeed = [
  {
    id: 'seed-in-1',
    date: '08-15',
    year: '1947',
    title: 'Indian Independence Declared',
    description: 'India achieved independence from British colonial rule after decades of non-violent and revolutionary freedom struggles led by Mahatma Gandhi, Jawaharlal Nehru, and countless freedom fighters.',
    country: 'India',
    source_url: 'https://en.wikipedia.org/wiki/Indian_Independence_Act_1947',
    ai_hook: 'Did you know? Jawaharlal Nehru delivered his iconic "Tryst with Destiny" speech to the Indian Constituent Assembly at the stroke of midnight.',
  },
  {
    id: 'seed-in-2',
    date: '01-26',
    year: '1950',
    title: 'Constitution of India Enacted',
    description: 'The Constitution of India, drafted under the leadership of Dr. B. R. Ambedkar, came into official effect, establishing India as a sovereign democratic republic.',
    country: 'India',
    source_url: 'https://en.wikipedia.org/wiki/Republic_Day_(India)',
    ai_hook: 'Did you know? It is the longest written national constitution of any sovereign nation in the world.',
  },
  {
    id: 'seed-in-3',
    date: '10-22',
    year: '2008',
    title: 'Chandrayaan-1 Lunar Mission Launch',
    description: 'ISRO successfully launched Chandrayaan-1 from Sriharikota, India\'s inaugural lunar probe, which confirmed the landmark discovery of water molecules on the Moon.',
    country: 'India',
    source_url: 'https://en.wikipedia.org/wiki/Chandrayaan-1',
    ai_hook: 'Did you know? Data from India\'s Moon Mineralogy Mapper confirmed the presence of hydroxyl and water molecules across lunar soil.',
  },
  {
    id: 'seed-1',
    date: '09-15',
    year: '1862',
    title: 'American Civil War: Battle of Harpers Ferry',
    description: 'Confederate forces under Stonewall Jackson captured the Union garrison at Harpers Ferry, Virginia, taking more than 12,000 prisoners in a major strategic victory.',
    country: 'United States',
    source_url: 'https://en.wikipedia.org/wiki/Battle_of_Harpers_Ferry',
    ai_hook: 'Did you know? It was the largest surrender of U.S. troops until the Battle of Bataan in WWII 80 years later!',
  },
  {
    id: 'seed-2',
    date: '09-15',
    year: '1935',
    title: 'Nuremberg Laws Enacted',
    description: 'The Nazi regime enacted the Nuremberg Laws during the annual party rally, depriving German Jews of citizenship and prohibiting intermarriage.',
    country: 'Germany',
    source_url: 'https://en.wikipedia.org/wiki/Nuremberg_Laws',
    ai_hook: 'Did you know? These laws formed the legal cornerstone of racial persecution leading directly to the Holocaust.',
  },
  {
    id: 'seed-3',
    date: '09-15',
    year: '2020',
    title: 'Signing of the Abraham Accords',
    description: 'The Abraham Accords were officially signed at the White House, establishing diplomatic relations between Israel, the UAE, and Bahrain.',
    country: 'United States',
    source_url: 'https://en.wikipedia.org/wiki/Abraham_Accords',
    ai_hook: 'Did you know? This marked the first normalization agreements between Israel and Arab nations in over 26 years.',
  },
];

/**
 * Format raw event data into clean, presentation-ready object with scope, category, and 1-2 line summary.
 */
function formatEvent(ev) {
  if (!ev) return null;

  // Clean title: replace underscores, remove trailing colons
  const rawTitle = ev.title || 'Historical Chronicle';
  const cleanTitle = rawTitle.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  // Normalize Year
  let formattedYear = '';
  if (ev.year) {
    const y = String(ev.year).trim();
    if (y.startsWith('-')) {
      formattedYear = `${y.replace('-', '')} BCE`;
    } else if (/^\d+$/.test(y)) {
      formattedYear = `${y} CE`;
    } else {
      formattedYear = y;
    }
  }

  // Detect Historical Scope (INDIA vs WORLD)
  const scope = detectEventScope(ev);

  // Assign Primary Category according to scope
  const category = classifyEventCategory(ev, scope);

  // Clean AI hook: remove surrounding quotes, trailing dots, think tags if any
  let cleanHook = ev.ai_hook || null;
  if (cleanHook) {
    cleanHook = cleanHook.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleanHook = cleanHook.replace(/^["']|["']$/g, '').trim();
    if (!cleanHook.toLowerCase().startsWith('did you know')) {
      cleanHook = `Did you know? ${cleanHook}`;
    }
  }

  // Derive concise 1-2 line short summary from stored content + Wikipedia extract
  const content = ev.description || ev.content || '';
  const shortDescription = deriveShortDescription(
    cleanTitle,
    content,
    category,
    formattedYear || ev.year,
    ev.extract || null
  );

  return {
    id: ev.id || `${cleanTitle}-${ev.year || Math.random()}`,
    date: ev.date || '',
    year: ev.year || '',
    formattedYear,
    title: cleanTitle,
    content,
    shortDescription,
    scope,
    category,
    source_url: ev.source_url || null,
    ai_hook: cleanHook,
    country: ev.country || null,
  };
}

/**
 * Helper to parse date string across all formats (YYYY-MM-DD, DD-MM-YYYY, etc.)
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(/[-/.]/);
  if (parts.length < 3) return null;

  let year, month, day;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    // Fallback: MM-DD-YYYY
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const standardStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, standardStr };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Events & Filter state
  const [allEvents, setAllEvents] = useState([]);
  const [selectedScope, setSelectedScope] = useState(SCOPES.INDIA);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [dateLabel, setDateLabel] = useState('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [visibleCount, setVisibleCount] = useState(25);

  // Modal detail view state
  const [activeModalEvent, setActiveModalEvent] = useState(null);

  const shouldReduceMotion = useReducedMotion();

  // Reset pagination when filtering or switching scopes, dates, or search
  const [filterKey, setFilterKey] = useState('');
  const currentFilterKey = `${selectedScope}-${selectedCategory}-${selectedDate}-${searchQuery}`;
  if (filterKey !== currentFilterKey) {
    setFilterKey(currentFilterKey);
    setVisibleCount(25);
  }

  // Load Initial Data (Today's Events + Bookmarks)
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      setLoadingEvents(true);
      try {
        const [eventsRes, bookmarksRes] = await Promise.allSettled([
          getTodayEventsApi(),
          user ? getMyBookmarksApi() : Promise.resolve([]),
        ]);

        if (isMounted && bookmarksRes.status === 'fulfilled' && Array.isArray(bookmarksRes.value)) {
          setBookmarkedIds(new Set(bookmarksRes.value.map(b => b.event_id || b.id)));
        }

        if (isMounted) {
          if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value) && eventsRes.value.length > 0) {
            setAllEvents(eventsRes.value.map(formatEvent));
          } else {
            setAllEvents(newsSeed.map(formatEvent));
          }
        }
      } catch (err) {
        console.error('Failed to load initial events:', err);
        if (isMounted) setAllEvents(newsSeed.map(formatEvent));
      } finally {
        if (isMounted) setLoadingEvents(false);
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Date Selection / Calendar Change
  const handleDateChange = useCallback(async (dateStr) => {
    if (!dateStr) return;
    const parsed = parseDateString(dateStr);
    if (!parsed) {
      console.warn('Could not parse date:', dateStr);
      return;
    }

    setSelectedDate(parsed.standardStr);

    const today = new Date();
    const isToday = (today.getMonth() + 1 === parsed.month) && (today.getDate() === parsed.day);

    const dateObj = new Date(2024, parsed.month - 1, parsed.day);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    setDateLabel(isToday ? 'Today' : `${monthName} ${parsed.day}`);

    setLoadingEvents(true);
    try {
      const events = isToday ? await getTodayEventsApi() : await getEventsByDateApi(parsed.month, parsed.day);
      if (Array.isArray(events) && events.length > 0) {
        setAllEvents(events.map(formatEvent));
        toast.success(
          isToday
            ? `Loaded ${events.length} historical events for Today (${monthName} ${parsed.day})!`
            : `Loaded ${events.length} historical events for ${monthName} ${parsed.day}!`
        );
      } else {
        setAllEvents([]);
        toast.info(`No historical records found for ${monthName} ${parsed.day}.`);
      }
    } catch (err) {
      console.error('Error fetching events by date:', err);
      toast.error('Could not load events for this date.');
    } finally {
      setLoadingEvents(false);
    }
  }, [toast]);

  // Quick Date Jump Handlers
  const handleResetToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleDateChange(`${year}-${month}-${day}`);
  };

  const handleYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleDateChange(`${year}-${month}-${day}`);
  };

  const handleRandomDate = () => {
    const pick = HISTORICAL_MYSTERY_DATES[Math.floor(Math.random() * HISTORICAL_MYSTERY_DATES.length)];
    const currentYear = new Date().getFullYear();
    const monthStr = String(pick.month).padStart(2, '0');
    const dayStr = String(pick.day).padStart(2, '0');
    toast.info(`Jumping to: ${pick.name}`);
    handleDateChange(`${currentYear}-${monthStr}-${dayStr}`);
  };

  // Search Submit Handler (Backend Search with fallback to client search)
  const handleSearchSubmit = async (e) => {
    e?.preventDefault?.();
    const query = searchQuery.trim();
    if (!query) {
      handleResetToday();
      return;
    }

    setLoadingEvents(true);
    try {
      const results = await searchEventsApi(query);
      if (Array.isArray(results) && results.length > 0) {
        setAllEvents(results.map(formatEvent));
        setDateLabel(`Search: "${query}"`);
        toast.success(`Found ${results.length} historical events matching "${query}"`);
      } else {
        // Fallback filter locally
        const filtered = allEvents.filter(
          item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.content.toLowerCase().includes(query.toLowerCase()) ||
            item.year.toLowerCase().includes(query.toLowerCase())
        );
        if (filtered.length > 0) {
          setAllEvents(filtered);
          setDateLabel(`Filtered: "${query}"`);
        } else {
          toast.info(`No historical events found for "${query}".`);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoadingEvents(false);
    }
  };

  // Bookmark Toggle Handler
  const toggleBookmark = async (e, eventId) => {
    e?.stopPropagation?.();
    if (!user) {
      toast.info('Please sign in to save chronicle bookmarks.');
      navigate('/loginpg');
      return;
    }

    const next = new Set(bookmarkedIds);
    if (next.has(eventId)) {
      next.delete(eventId);
      setBookmarkedIds(next);
      try {
        await removeBookmarkApi(eventId);
        toast.success('Bookmark removed');
      } catch {
        // Revert on error
        next.add(eventId);
        setBookmarkedIds(new Set(next));
        toast.error('Failed to remove bookmark.');
      }
    } else {
      next.add(eventId);
      setBookmarkedIds(next);
      try {
        await addBookmarkApi(eventId);
        toast.success('Chronicle saved to bookmarks!');
      } catch {
        // Revert on error
        next.delete(eventId);
        setBookmarkedIds(new Set(next));
        toast.error('Failed to save bookmark.');
      }
    }
  };

  // Share Event Handler
  const handleShareEvent = (e, item) => {
    e?.stopPropagation?.();
    const textToShare = `📜 HistoFacts: ${item.title} (${item.formattedYear || item.year})\n[${item.scope} • ${item.category}]\n\n${item.shortDescription ? `${item.shortDescription}\n\n` : ''}${item.ai_hook ? `✨ ${item.ai_hook}\n\n` : ''}${item.content}\n\nRead more: ${item.source_url || window.location.href}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToShare);
      toast.success('Chronicle summary copied to clipboard!');
    } else {
      toast.info('Sharing summary generated!');
    }
  };

  // Handle Scope Switching (INDIA | WORLD)
  const handleScopeChange = (newScope) => {
    if (newScope === selectedScope) return;
    setSelectedScope(newScope);
    if (selectedCategory !== 'Bookmarks') {
      setSelectedCategory('All');
    }
    setVisibleCount(25);
  };

  // Compute Scopes, Categories & Live Counts
  const { scopeCounts, categoryCounts } = useMemo(() => {
    const sCounts = {
      [SCOPES.INDIA]: 0,
      [SCOPES.WORLD]: 0,
    };

    const categoriesForScope = selectedScope === SCOPES.INDIA ? INDIA_CATEGORIES : WORLD_CATEGORIES;
    const cCounts = {
      All: 0,
      Bookmarks: 0,
    };
    categoriesForScope.forEach((cat) => {
      cCounts[cat] = 0;
    });

    allEvents.forEach((ev) => {
      const evScope = ev.scope || SCOPES.WORLD;
      if (sCounts[evScope] !== undefined) {
        sCounts[evScope]++;
      } else {
        sCounts[SCOPES.WORLD]++;
      }

      // Tally categories if event matches current scope
      if (evScope === selectedScope) {
        cCounts.All++;
        if (cCounts[ev.category] !== undefined) {
          cCounts[ev.category]++;
        } else {
          cCounts['Politics & Governance'] = (cCounts['Politics & Governance'] || 0) + 1;
        }
      }

      if (bookmarkedIds.has(ev.id)) {
        cCounts.Bookmarks++;
      }
    });

    return { scopeCounts: sCounts, categoryCounts: cCounts };
  }, [allEvents, selectedScope, bookmarkedIds]);

  // Filtered Events based on Scope, Category and Search Query
  const displayedEvents = useMemo(() => {
    let list = allEvents;

    // 1. Filter by Scope (or show all saved bookmarks if user selected Bookmarks)
    if (selectedCategory === 'Bookmarks') {
      list = list.filter((ev) => bookmarkedIds.has(ev.id));
    } else {
      list = list.filter((ev) => (ev.scope || SCOPES.WORLD) === selectedScope);
      if (selectedCategory !== 'All') {
        list = list.filter((ev) => ev.category === selectedCategory);
      }
    }

    // 2. Live search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          ev.content.toLowerCase().includes(q) ||
          (ev.shortDescription && ev.shortDescription.toLowerCase().includes(q)) ||
          (ev.formattedYear && ev.formattedYear.toLowerCase().includes(q)) ||
          (ev.ai_hook && ev.ai_hook.toLowerCase().includes(q)) ||
          (ev.category && ev.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allEvents, selectedScope, selectedCategory, searchQuery, bookmarkedIds]);

  // Windowed events slice for fast DOM rendering and smooth scroll performance
  const pagedEvents = useMemo(() => {
    return displayedEvents.slice(0, visibleCount);
  }, [displayedEvents, visibleCount]);

  // Top Feature Banner (Hero Event)
  const heroEvent = useMemo(() => {
    return displayedEvents[0] || allEvents[0] || newsSeed[0];
  }, [displayedEvents, allEvents]);

  // Animation variants
  const customPageVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 },
    },
  }), [shouldReduceMotion]);

  const customItemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0.2 }
        : { type: 'spring', stiffness: 120, damping: 18 },
    },
  }), [shouldReduceMotion]);

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={customPageVariants}
        className="flex-1 flex flex-col pb-16"
      >
        {/* Main Content Layout */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1720px] mx-auto w-full grid grid-cols-1 lg:grid-cols-10 gap-6">

          {/* Left Column: Feed & Primary Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* Feature Banner (Hero Section) */}
            {heroEvent && (
              <motion.section
                variants={customItemVariants}
                whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: 'var(--shadow-deep)' }}
                className="relative overflow-hidden border border-histo-dark/15 bg-histo-dark text-histo-paper shadow-medium p-1 rounded-[4px]"
              >
                {/* Vintage Pattern Backdrop */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                  }}
                />

                <div className="border-2 border-double border-histo-gold/30 p-6 md:p-8 relative z-10 flex flex-col items-center text-center">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-[4px] text-histo-gold font-ui font-semibold">
                      Today in History
                    </span>
                    <span className="text-histo-gold/40">•</span>
                    <span className="text-[10px] uppercase tracking-widest font-mono text-histo-paper/60">
                      {dateLabel}
                    </span>
                  </div>

                  <h2 className="mb-2 font-display text-lg font-bold tracking-[2px] text-histo-paper uppercase opacity-80">
                    HISTOFACTS
                  </h2>

                  <div className="max-w-2xl my-3">
                    <div className="flex items-center justify-center gap-2 mb-2.5 flex-wrap">
                      {heroEvent.formattedYear && (
                        <span className="inline-block px-3 py-1 bg-histo-gold/20 text-histo-gold border border-histo-gold/40 rounded-full text-xs font-mono font-bold tracking-widest uppercase">
                          {heroEvent.formattedYear}
                        </span>
                      )}
                      <span className="text-[10px] font-ui px-2.5 py-0.5 rounded-full bg-white/10 text-histo-paper/90 border border-white/20 uppercase tracking-wider font-semibold">
                        {heroEvent.scope === 'INDIA' ? '🇮🇳 India' : '🌍 World'}
                      </span>
                      <span className="text-[10px] font-ui px-2.5 py-0.5 rounded-full bg-histo-gold/20 text-histo-gold border border-histo-gold/30 uppercase tracking-wider font-semibold">
                        {heroEvent.category}
                      </span>
                    </div>

                    <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight text-white mb-2">
                      {heroEvent.title}
                    </h3>

                    {heroEvent.shortDescription && (
                      <p className="font-body text-xs md:text-sm text-histo-gold/90 font-medium italic mb-3">
                        {heroEvent.shortDescription}
                      </p>
                    )}

                    {/* AI Curiosity Hook highlight if present */}
                    {heroEvent.ai_hook && (
                      <div className="my-3 px-4 py-2.5 rounded-[3px] bg-gradient-to-r from-histo-gold/20 via-amber-500/10 to-transparent border-l-2 border-histo-gold text-left max-w-xl mx-auto flex items-start gap-2.5">
                        <Sparkles className="h-4 w-4 text-histo-gold shrink-0 mt-0.5" />
                        <p className="font-body text-xs italic text-histo-gold/95 leading-relaxed">
                          {heroEvent.ai_hook}
                        </p>
                      </div>
                    )}

                    <p className="font-body text-histo-paper/80 text-sm leading-relaxed mb-4 line-clamp-3">
                      {heroEvent.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <motion.button
                      type="button"
                      onClick={() => setActiveModalEvent(heroEvent)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="inline-flex items-center gap-2 border border-histo-gold bg-histo-gold text-histo-dark hover:bg-transparent hover:text-histo-gold font-ui text-xs font-bold tracking-widest uppercase py-2.5 px-6 rounded-[2px] shadow-soft transition-colors duration-300 cursor-pointer"
                    >
                      <span>Read Full Story</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </motion.button>

                    {heroEvent.source_url && (
                      <a
                        href={heroEvent.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-white/20 text-histo-paper/80 hover:text-white hover:border-white/40 font-ui text-xs tracking-wider uppercase py-2.5 px-4 rounded-[2px] transition-colors duration-200"
                        title="Read full article on Wikipedia"
                      >
                        <span>Read on Wikipedia</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Historical Calendar Controls Bar */}
            <motion.section
              variants={customItemVariants}
              className="border border-histo-dark/15 bg-histo-cream/90 p-4 rounded-[4px] shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Date Indicator */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/70 rounded-full shadow-soft">
                  <Calendar className="h-5 w-5 text-histo-copper" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base md:text-lg font-bold text-histo-dark">
                      Historical Calendar
                    </h3>
                    <span className="text-[10px] font-ui px-2 py-0.5 rounded bg-histo-copper/10 text-histo-copper font-semibold uppercase tracking-wider">
                      {dateLabel}
                    </span>
                  </div>
                  <p className="text-xs font-ui text-histo-ink/65">
                    Browse historical events for any day of the year
                  </p>
                </div>
              </div>

              {/* Interactive Date Picker & Action Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Native Date Input */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-histo-dark/20 rounded-[3px] shadow-xs">
                  <Calendar className="h-3.5 w-3.5 text-histo-copper" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="text-xs font-ui bg-transparent border-none text-histo-dark focus:outline-none cursor-pointer"
                    title="Choose a specific date to explore"
                  />
                </div>

                {/* Quick Presets */}
                <button
                  type="button"
                  onClick={handleResetToday}
                  className="flex items-center gap-1 text-xs font-ui font-semibold text-histo-dark bg-white/80 hover:bg-white border border-histo-dark/15 px-2.5 py-1.5 rounded-[3px] transition-colors cursor-pointer"
                  title="Return to today's events"
                >
                  <RotateCcw className="h-3 w-3 text-histo-copper" />
                  <span>Today</span>
                </button>

                <button
                  type="button"
                  onClick={handleYesterday}
                  className="text-xs font-ui font-medium text-histo-dark/80 bg-white/60 hover:bg-white border border-histo-dark/10 px-2.5 py-1.5 rounded-[3px] transition-colors cursor-pointer"
                  title="View yesterday's events"
                >
                  Yesterday
                </button>

                <button
                  type="button"
                  onClick={handleRandomDate}
                  className="flex items-center gap-1 text-xs font-ui font-semibold text-histo-copper bg-histo-copper/10 hover:bg-histo-copper/20 border border-histo-copper/25 px-2.5 py-1.5 rounded-[3px] transition-colors cursor-pointer"
                  title="Jump to a landmark historical date"
                >
                  <Shuffle className="h-3 w-3" />
                  <span>Random Date</span>
                </button>
              </div>
            </motion.section>

            {/* Category Filter Pills & Search */}
            <motion.div variants={customItemVariants} className="flex flex-col gap-3">
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-histo-ink/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search historical events by keyword, year, or figure..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 bg-white border border-histo-dark/15 rounded-[3px] text-xs font-ui text-histo-dark placeholder:text-histo-ink/40 focus:outline-none focus:border-histo-copper shadow-xs transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      handleResetToday();
                    }}
                    className="absolute right-12 text-histo-ink/40 hover:text-histo-dark p-1 cursor-pointer"
                    title="Clear search and return to Today"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1.5 px-3 py-1 bg-histo-dark text-histo-paper hover:bg-histo-copper text-[11px] font-ui font-semibold uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>

              {/* Historical Scope Selector (INDIA | WORLD) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 p-1 bg-white/80 border border-histo-dark/15 rounded-[4px] shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleScopeChange(SCOPES.INDIA)}
                    className={`px-3.5 py-1.5 rounded-[3px] text-xs font-ui font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                      selectedScope === SCOPES.INDIA
                        ? 'bg-histo-dark text-histo-paper shadow-soft'
                        : 'text-histo-ink/70 hover:text-histo-dark hover:bg-histo-paper/60'
                    }`}
                  >
                    <span>🇮🇳 India</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        selectedScope === SCOPES.INDIA
                          ? 'bg-histo-gold text-histo-dark font-bold'
                          : 'bg-histo-dark/10 text-histo-ink/60'
                      }`}
                    >
                      {scopeCounts[SCOPES.INDIA]}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScopeChange(SCOPES.WORLD)}
                    className={`px-3.5 py-1.5 rounded-[3px] text-xs font-ui font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                      selectedScope === SCOPES.WORLD
                        ? 'bg-histo-dark text-histo-paper shadow-soft'
                        : 'text-histo-ink/70 hover:text-histo-dark hover:bg-histo-paper/60'
                    }`}
                  >
                    <span>🌍 World</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        selectedScope === SCOPES.WORLD
                          ? 'bg-histo-gold text-histo-dark font-bold'
                          : 'bg-histo-dark/10 text-histo-ink/60'
                      }`}
                    >
                      {scopeCounts[SCOPES.WORLD]}
                    </span>
                  </button>
                </div>

                <span className="text-[11px] font-ui text-histo-ink/55 italic">
                  Viewing {selectedScope === SCOPES.INDIA ? 'Indian history chronology' : 'World historical chronology'}
                </span>
              </div>

              {/* Responsive Category Chips Navigation */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
                {/* All Scope Events Chip */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-[3px] text-xs font-ui font-semibold transition-all duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedCategory === 'All'
                      ? 'bg-histo-dark text-histo-paper shadow-soft'
                      : 'bg-white/70 hover:bg-white text-histo-ink/75 border border-histo-dark/10'
                  }`}
                >
                  <span>All Events</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedCategory === 'All'
                        ? 'bg-histo-gold text-histo-dark font-bold'
                        : 'bg-histo-dark/10 text-histo-ink/60'
                    }`}
                  >
                    {categoryCounts.All}
                  </span>
                </button>

                {/* Scope-Specific Category Chips */}
                {(selectedScope === SCOPES.INDIA ? INDIA_CATEGORIES : WORLD_CATEGORIES).map((catName) => {
                  const isActive = selectedCategory === catName;
                  const count = categoryCounts[catName] || 0;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setSelectedCategory(catName)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-[3px] text-xs font-ui font-semibold transition-all duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-histo-dark text-histo-paper shadow-soft'
                          : 'bg-white/70 hover:bg-white text-histo-ink/75 border border-histo-dark/10'
                      }`}
                    >
                      <span>{catName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? 'bg-histo-gold text-histo-dark font-bold'
                            : 'bg-histo-dark/10 text-histo-ink/60'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                {/* Saved Bookmarks Filter */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Bookmarks')}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-[3px] text-xs font-ui font-semibold transition-all duration-200 flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedCategory === 'Bookmarks'
                      ? 'bg-histo-dark text-histo-paper shadow-soft'
                      : 'bg-white/70 hover:bg-white text-histo-ink/75 border border-histo-dark/10'
                  }`}
                >
                  <span>Saved Bookmarks</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedCategory === 'Bookmarks'
                        ? 'bg-histo-gold text-histo-dark font-bold'
                        : 'bg-histo-dark/10 text-histo-ink/60'
                    }`}
                  >
                    {categoryCounts.Bookmarks}
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Historical Events Chronicle Feed */}
            <motion.section
              variants={customItemVariants}
              className="border border-histo-dark/10 bg-histo-cream p-4 md:p-6 shadow-soft rounded-[4px]"
            >
              <div className="mb-4 flex items-center justify-between border-b border-histo-dark/10 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-histo-copper" />
                  <h3 className="font-display text-lg md:text-xl font-bold text-histo-dark">
                    Historical Events
                  </h3>
                  <span className="text-xs font-ui text-histo-ink/60">
                    ({displayedEvents.length} {displayedEvents.length === 1 ? 'entry' : 'entries'})
                  </span>
                </div>
                <span className="text-[11px] font-ui text-histo-copper font-medium">
                  Click any card to read the full story
                </span>
              </div>

              {/* Feed Content */}
              <div className="min-h-[220px]">
                {loadingEvents ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-histo-copper/30 border-t-histo-copper rounded-full animate-spin" />
                    <span className="text-xs font-ui text-histo-ink/60 tracking-wider uppercase">
                      Loading historical events...
                    </span>
                  </div>
                ) : displayedEvents.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-histo-copper/10 text-histo-copper mb-3">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <h4 className="font-display text-base font-bold text-histo-dark mb-1">
                      No Historical Events Found
                    </h4>
                    <p className="text-xs font-ui text-histo-ink/60 max-w-sm mx-auto mb-4">
                      {selectedCategory === 'Bookmarks'
                        ? "You haven't bookmarked any events yet. Click the bookmark icon on any card to save it."
                        : `No entries recorded under "${selectedCategory}" for this date. Try another category or date.`}
                    </p>
                    <button
                      type="button"
                      onClick={handleResetToday}
                      className="px-4 py-2 bg-histo-copper text-white text-xs font-ui font-semibold rounded-[2px] uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer"
                    >
                      Reset to Today
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {pagedEvents.map((item, idx) => {
                      const isBookmarked = bookmarkedIds.has(item.id);
                      return (
                        <motion.article
                          key={item.id || idx}
                          onClick={() => setActiveModalEvent(item)}
                          whileHover={shouldReduceMotion ? {} : { x: 4, transition: { duration: 0.15 } }}
                          className="border-l-4 border-histo-gold bg-white/75 hover:bg-white p-4 md:p-5 shadow-soft transition-all duration-200 rounded-[2px] cursor-pointer group relative border-t border-r border-b border-histo-dark/5"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Year Badge */}
                              {item.formattedYear && (
                                <span className="font-mono text-xs font-bold text-histo-dark bg-histo-gold/25 border border-histo-gold/50 px-2 py-0.5 rounded-[2px]">
                                  {item.formattedYear}
                                </span>
                              )}

                              {/* Category Badge */}
                              <span
                                className={`text-[10px] font-ui tracking-wider uppercase font-semibold px-2 py-0.5 rounded-[2px] border ${getCategoryBadgeClass(
                                  item.category
                                )}`}
                              >
                                {item.category}
                              </span>
                            </div>

                            {/* Actions (Bookmark & Share) */}
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleShareEvent(e, item)}
                                className="p-1.5 rounded-full text-histo-ink/40 hover:text-histo-dark hover:bg-histo-dark/5 transition-colors cursor-pointer"
                                title="Share or copy event summary"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => toggleBookmark(e, item.id)}
                                className="p-1.5 rounded-full text-histo-ink/40 hover:text-histo-gold hover:bg-histo-gold/10 transition-colors cursor-pointer"
                                title={isBookmarked ? 'Remove from bookmarks' : 'Bookmark this event'}
                              >
                                <Bookmark
                                  className={`h-4 w-4 ${isBookmarked ? 'text-histo-gold fill-histo-gold' : ''
                                    }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Event Title */}
                          <h4 className="font-display text-base md:text-lg font-bold text-histo-dark tracking-wide mb-2 group-hover:text-histo-copper transition-colors">
                            {item.title}
                          </h4>

                          {/* Sparkling AI Hook Highlight if present */}
                          {item.ai_hook && (
                            <div className="my-2.5 p-2.5 rounded-[2px] bg-gradient-to-r from-amber-500/10 via-histo-gold/15 to-transparent border-l-2 border-histo-gold flex items-start gap-2">
                              <Sparkles className="h-3.5 w-3.5 text-histo-gold shrink-0 mt-0.5" />
                              <div>
                                <span className="font-ui font-bold tracking-wider text-histo-copper uppercase text-[9px] block">
                                  Did You Know?
                                </span>
                                <p className="font-body text-xs italic text-histo-ink/90 leading-relaxed">
                                  {item.ai_hook}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Short Description Preview */}
                          {item.shortDescription && (
                            <p className="font-body text-xs italic text-histo-ink/60 leading-relaxed mb-1.5">
                              {item.shortDescription}
                            </p>
                          )}

                          {/* Event Narrative */}
                          <p className="font-body text-sm text-histo-ink/85 leading-relaxed line-clamp-2">
                            {item.content}
                          </p>

                          {/* Card Footer Link */}
                          <div className="mt-3 pt-2 border-t border-histo-dark/5 flex items-center justify-between text-[11px] font-ui text-histo-copper font-semibold">
                            <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-200">
                              Read Story <ChevronRight className="h-3 w-3" />
                            </span>
                            {item.source_url && (
                              <span className="text-histo-ink/40 font-normal text-[10px]">
                                Wikipedia Article Available
                              </span>
                            )}
                          </div>
                        </motion.article>
                      );
                    })}

                    {/* Progressive Pagination Load More Button */}
                    {visibleCount < displayedEvents.length && (
                      <div className="pt-4 pb-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 25)}
                          className="px-6 py-2.5 bg-histo-dark hover:bg-histo-copper text-histo-paper text-xs font-ui font-semibold uppercase tracking-wider rounded-[2px] transition-all shadow-soft hover:shadow-medium cursor-pointer flex items-center gap-2"
                        >
                          <span>Show More Events ({pagedEvents.length} of {displayedEvents.length})</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.section>

          </div>

          {/* Right Column: Featured Era & Historical Manuscript (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-6">

            {/* Featured Era Card */}
            <motion.section
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: 'var(--shadow-medium)' }}
              className="border border-histo-dark/15 bg-histo-cream p-5 shadow-soft rounded-[4px] flex flex-col"
            >
              <div className="mb-4 flex items-center gap-3 border-b border-histo-dark/10 pb-3">
                <div className="flex h-9 w-9 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/60 rounded-full shadow-soft">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold tracking-wide text-histo-dark">
                    Epoch in Focus
                  </h3>
                  <span className="text-[10px] font-ui tracking-wider uppercase text-histo-copper font-semibold">
                    The Enlightenment
                  </span>
                </div>
              </div>

              <div className="border border-histo-dark/10 bg-white/70 p-5 rounded-[2px] flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-histo-copper/30 bg-white text-histo-copper shadow-soft">
                  <Crown className="h-6 w-6" />
                </div>

                <h4 className="font-display text-lg font-bold text-histo-dark mb-1.5">
                  Age of Reason
                </h4>
                <p className="font-body text-xs text-histo-ink/80 leading-relaxed mb-4">
                  Explore how 18th-century philosophy, scientific revolutions, and the pursuit of liberty redefined governance and knowledge across the globe.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('Enlightenment');
                    handleSearchSubmit();
                  }}
                  className="font-ui text-xs font-bold tracking-widest uppercase border-b-2 border-histo-copper text-histo-copper pb-0.5 hover:text-histo-dark hover:border-histo-dark transition-colors duration-200 cursor-pointer"
                >
                  Explore Events →
                </button>
              </div>
            </motion.section>

            {/* Historical Quote (Manuscript Snippet) */}
            <motion.section
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: 'var(--shadow-medium)' }}
              className="border border-histo-dark/15 bg-white p-5 shadow-soft rounded-[4px] flex flex-col relative overflow-hidden"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-histo-gold/40" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-histo-gold/40" />

              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[3px] text-histo-copper font-ui font-semibold">
                  Historical Quote
                </span>
                <Bookmark className="h-3.5 w-3.5 text-histo-copper/50" />
              </div>

              <blockquote className="font-display text-sm md:text-base italic text-histo-dark leading-relaxed text-center my-3 relative">
                &ldquo;History is a gallery of pictures in which there are few originals and many copies.&rdquo;
              </blockquote>
              <cite className="font-ui text-[11px] font-semibold text-center text-histo-ink/60 not-italic block uppercase tracking-widest mt-1">
                — Alexis de Tocqueville
              </cite>
            </motion.section>

            {/* AI Note Generator Teaser */}
            <motion.section
              variants={customItemVariants}
              className="border border-histo-gold/40 bg-gradient-to-br from-histo-dark to-[#162534] text-histo-paper p-5 shadow-medium rounded-[4px] relative overflow-hidden"
            >
              <div className="flex items-center gap-2 text-histo-gold mb-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-ui tracking-[2px] uppercase font-bold">
                  AI Study Assistant
                </span>
              </div>
              <h4 className="font-display text-base font-bold mb-2">
                Turn History Into Study Notes
              </h4>
              <p className="font-body text-xs text-histo-paper/70 mb-4 leading-relaxed">
                Generate structured, curriculum-aligned study notes (NCERT, UPSC, AP World) from any historical period with one click.
              </p>
              <Link
                to="/notes"
                className="inline-flex items-center gap-1.5 text-xs font-ui font-bold uppercase tracking-wider bg-histo-gold text-histo-dark hover:bg-white px-4 py-2 rounded-[2px] transition-colors shadow-soft"
              >
                <span>Open AI Notes</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </motion.section>

          </div>

        </main>
      </motion.div>

      {/* RICH EVENT DETAILS MODAL */}
      <AnimatePresence>
        {activeModalEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModalEvent(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-histo-paper border-2 border-double border-histo-gold/50 shadow-deep rounded-[4px] p-6 md:p-8 relative max-h-[90vh] overflow-y-auto"
            >
              {/* Corner Ornaments */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-histo-gold pointer-events-none" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-histo-gold pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-histo-gold pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-histo-gold pointer-events-none" />

              {/* Modal Header — CATEGORY • DATE line */}
              <div className="flex items-center justify-between pb-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Scope Badge */}
                  <span className="text-[10px] font-ui px-2 py-0.5 rounded-full bg-histo-dark/5 text-histo-ink/70 border border-histo-dark/10 uppercase tracking-wider font-semibold">
                    {activeModalEvent.scope === 'INDIA' ? '🇮🇳 India' : '🌍 World'}
                  </span>

                  {/* Category Badge */}
                  <span
                    className={`text-[10px] font-ui tracking-widest uppercase font-semibold px-2.5 py-0.5 rounded-[2px] border ${getCategoryBadgeClass(
                      activeModalEvent.category
                    )}`}
                  >
                    {activeModalEvent.category}
                  </span>

                  {/* Separator + Date/Year */}
                  {(activeModalEvent.formattedYear || activeModalEvent.date) && (
                    <>
                      <span className="text-histo-ink/30 text-xs select-none">•</span>
                      <span className="font-mono text-xs font-bold text-histo-dark">
                        {activeModalEvent.formattedYear || activeModalEvent.date}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModalEvent(null)}
                  className="p-1.5 rounded-full text-histo-ink/50 hover:text-histo-dark hover:bg-histo-dark/10 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Title */}
              <h2 className="font-display text-2xl md:text-3xl font-bold text-histo-dark leading-snug mb-2">
                {activeModalEvent.title}
              </h2>

              {/* Short Description — subtle italicized 1-2 line summary */}
              {activeModalEvent.shortDescription && (
                <p className="font-body text-sm italic text-histo-ink/65 leading-relaxed mb-4">
                  {activeModalEvent.shortDescription}
                </p>
              )}

              {/* Visual Divider */}
              <div className="border-t border-histo-dark/10 mb-5" />

              {/* Sparkling AI Hook Highlight */}
              {activeModalEvent.ai_hook && (
                <div className="mb-5 p-4 rounded-[3px] bg-gradient-to-r from-amber-500/15 via-histo-gold/20 to-transparent border-l-4 border-histo-gold">
                  <div className="flex items-center gap-2 mb-1 text-histo-copper font-ui font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-histo-gold" />
                    <span>Did You Know?</span>
                  </div>
                  <p className="font-body text-sm italic text-histo-dark font-medium leading-relaxed">
                    &ldquo;{activeModalEvent.ai_hook}&rdquo;
                  </p>
                </div>
              )}

              {/* Full Narrative Content */}
              <div className="border-t border-b border-histo-dark/10 py-4 mb-6">
                <span className="text-[10px] font-ui tracking-[2px] uppercase text-histo-ink/50 block mb-2 font-semibold">
                  Historical Event Details
                </span>
                <p className="font-body text-base text-histo-dark leading-relaxed">
                  {activeModalEvent.content}
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {activeModalEvent.source_url && (
                    <a
                      href={activeModalEvent.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-histo-dark text-histo-paper hover:bg-histo-copper px-4 py-2 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider transition-colors shadow-soft"
                    >
                      <span>Read on Wikipedia</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={(e) => toggleBookmark(e, activeModalEvent.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[2px] text-xs font-ui font-semibold border transition-colors cursor-pointer ${bookmarkedIds.has(activeModalEvent.id)
                        ? 'bg-histo-gold/20 text-histo-dark border-histo-gold'
                        : 'bg-white text-histo-ink border-histo-dark/20 hover:bg-histo-dark/5'
                      }`}
                  >
                    <Bookmark
                      className={`h-3.5 w-3.5 ${bookmarkedIds.has(activeModalEvent.id)
                          ? 'text-histo-gold fill-histo-gold'
                          : ''
                        }`}
                    />
                    <span>
                      {bookmarkedIds.has(activeModalEvent.id) ? 'Saved' : 'Bookmark'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleShareEvent(e, activeModalEvent)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-histo-ink border border-histo-dark/20 hover:bg-histo-dark/5 rounded-[2px] text-xs font-ui font-semibold transition-colors cursor-pointer"
                    title="Copy event summary"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModalEvent(null)}
                  className="px-4 py-2 border border-histo-dark/20 text-histo-ink hover:text-histo-dark text-xs font-ui font-semibold rounded-[2px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
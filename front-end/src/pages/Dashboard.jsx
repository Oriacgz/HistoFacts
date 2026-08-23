import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  MessageSquare,
  Settings,
  Crown,
  Filter,
  LogOut,
  Search,
  Clock,
  User,
  Users,
  Menu,
  X,
  Plus,
  Hash,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getTodayEventsApi, searchEventsApi, addBookmarkApi, removeBookmarkApi } from '../api/history';
import Navbar from '../components/Navbar';

const headerIcons = [
  { icon: Filter, label: 'Filters' },
  { icon: Bell, label: 'Notifications' },
  { icon: Calendar, label: 'Historical Calendar' },
];

const newsSeed = [
  { 
    id: 'seed-1',
    title: 'On This Day: March 17', 
    content: 'Historical events that happened on this day will appear here. In 461 AD, Saint Patrick, the patron saint of Ireland, died in Saul.',
    category: 'World History'
  },
  { 
    id: 'seed-2',
    title: 'March 17, 1801', 
    content: 'The Union Parliament meets for the first time, following the Act of Union between Great Britain and Ireland.',
    category: 'Politics'
  },
  { 
    id: 'seed-3',
    title: 'March 17, 1959', 
    content: 'Tenzin Gyatso, the 14th Dalai Lama, flees Tibet for India during the Tibetan uprising.',
    category: 'Independence & Freedom'
  }
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [newsItems, setNewsItems] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const customPageVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
      },
    },
  }), [shouldReduceMotion]);

  const customItemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.2 } : {
        type: 'spring',
        stiffness: 100,
        damping: 16,
      },
    },
  }), [shouldReduceMotion]);

  const listContainerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 }
    }
  }), [shouldReduceMotion]);

  const listItemVariants = useMemo(() => ({
    hidden: { opacity: 0, x: shouldReduceMotion ? 0 : -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: shouldReduceMotion ? { duration: 0.2 } : { type: "spring", stiffness: 120, damping: 15 }
    }
  }), [shouldReduceMotion]);

  useEffect(() => {
    async function loadEvents() {
      setLoadingEvents(true);
      try {
        const events = await getTodayEventsApi();
        if (events && events.length > 0) {
          setNewsItems(events.map(ev => ({
            id: ev.id,
            title: ev.year ? `${ev.title} (${ev.year})` : ev.title,
            content: ev.description,
            category: ev.category || 'General',
          })));
        } else {
          setNewsItems(newsSeed);
        }
      } catch {
        setNewsItems(newsSeed);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadEvents();

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingEvents(true);
    try {
      const results = await searchEventsApi(searchQuery.trim());
      setNewsItems(results.map(ev => ({
        id: ev.id,
        title: ev.year ? `${ev.title} (${ev.year})` : ev.title,
        content: ev.description,
        category: ev.category || 'General',
      })));
    } catch {
      // Keep existing
    } finally {
      setLoadingEvents(false);
    }
  };

  const toggleBookmark = async (eventId) => {
    const next = new Set(bookmarkedIds);
    if (next.has(eventId)) {
      next.delete(eventId);
      setBookmarkedIds(next);
      try { await removeBookmarkApi(eventId); } catch { /* ignore */ }
    } else {
      next.add(eventId);
      setBookmarkedIds(next);
      try { await addBookmarkApi(eventId); } catch { /* ignore */ }
    }
  };

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={customPageVariants}
        className="flex-1 flex flex-col"
      >
        {/* Content Layout */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1720px] mx-auto w-full grid grid-cols-1 lg:grid-cols-10 gap-6">
          
          {/* Left Column: Feature Banner & Events Feed (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Feature Banner (Hero) */}
            <motion.section 
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.008, boxShadow: 'var(--shadow-deep)' }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative overflow-hidden border border-histo-dark/10 bg-histo-dark text-histo-paper shadow-medium p-1 rounded-[4px] cursor-pointer"
            >
              <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
              <div className="border-2 border-double border-histo-gold/30 p-6 md:p-8 relative z-10 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-[4px] text-histo-gold font-ui font-semibold mb-3">Chronicle Feature</span>
                <h2 className="mb-4 font-display text-lg font-bold tracking-[2px] text-histo-paper uppercase opacity-80">HISTOFACTS</h2>
                
                <div className="max-w-2xl my-4">
                  <span className="text-sm font-ui text-histo-gold tracking-widest uppercase font-semibold block mb-2">Today in History</span>
                  <p className="font-display text-2xl md:text-3xl font-bold leading-tight text-white mb-4">
                    March 17, 461 AD — Death of Saint Patrick
                  </p>
                  <p className="font-body text-histo-paper/70 text-sm leading-relaxed mb-6 italic">
                    Saint Patrick, the patron saint of Ireland, dies in Saul. His life, mission, and legend would shape the spiritual and cultural landscape of Ireland and the Western world for centuries to come.
                  </p>
                </div>

                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block border border-histo-gold bg-histo-gold text-histo-dark hover:bg-transparent hover:text-histo-gold font-ui text-xs font-bold tracking-widest uppercase py-3 px-6 rounded-[2px] shadow-soft transition-colors duration-300"
                >
                  Explore Significance
                </motion.a>
              </div>
            </motion.section>

            {/* Historical Events Feed */}
            <motion.section 
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01, boxShadow: 'var(--shadow-medium)' }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="border border-histo-dark/10 bg-histo-cream p-4 md:p-6 shadow-soft rounded-[4px]"
            >
              <div className="mb-4 md:mb-6 flex items-center justify-between border-b border-histo-dark/10 pb-3 md:pb-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex h-8 md:h-10 w-8 md:w-10 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/40 rounded-full shadow-soft">
                    <Clock className="h-4 md:h-5 w-4 md:w-5" />
                  </div>
                  <h3 className="font-display text-lg md:text-2xl font-bold tracking-wide text-histo-dark">Historical Events</h3>
                </div>
                <span className="text-xs font-ui tracking-wider text-histo-ink/60 uppercase">Chronology</span>
              </div>

              <div className="min-h-[120px] flex flex-col gap-3 md:gap-4">
                {newsItems.length === 0 ? (
                  <div className="py-6 text-center text-sm font-body italic text-histo-ink/60">Loading today&apos;s chronicle events...</div>
                ) : (
                  <motion.div 
                    initial="hidden"
                    animate="visible"
                    variants={listContainerVariants}
                    className="flex flex-col gap-3 md:gap-4"
                  >
                    {newsItems.map((item, idx) => (
                      <motion.article 
                        key={(item.id || item.title) + idx}
                        variants={listItemVariants}
                        whileHover={shouldReduceMotion ? {} : { x: 4, transition: { type: "spring", stiffness: 300, damping: 15 } }}
                        className="border-l-4 border-histo-gold bg-white/60 hover:bg-white/90 p-4 md:p-5 shadow-soft transition-colors duration-200 rounded-[2px] cursor-pointer relative group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-ui tracking-widest uppercase text-histo-copper font-semibold bg-histo-copper/10 px-2 py-0.5 rounded-[2px]">
                            {item.category || 'History'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(item.id); }}
                            className="p-1 rounded-full text-histo-ink/40 hover:text-histo-gold transition-colors"
                            title={bookmarkedIds.has(item.id) ? 'Remove Bookmark' : 'Bookmark Event'}
                          >
                            <Bookmark className={`h-4 w-4 ${bookmarkedIds.has(item.id) ? 'text-histo-gold fill-histo-gold' : ''}`} />
                          </button>
                        </div>
                        <h4 className="mb-2 font-display text-base md:text-lg font-bold text-histo-dark tracking-wide">{item.title}</h4>
                        <p className="font-body text-sm text-histo-ink leading-relaxed">{item.content}</p>
                      </motion.article>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.section>
            
          </div>

          {/* Right Column: Featured Period & Quote (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            {/* Featured Era */}
            <motion.section 
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01, boxShadow: 'var(--shadow-medium)' }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="border border-histo-dark/10 bg-histo-cream p-4 md:p-6 shadow-soft rounded-[4px] flex flex-col"
            >
              <div className="mb-4 md:mb-6 flex items-center gap-3 md:gap-4 border-b border-histo-dark/10 pb-3 md:pb-4">
                <div className="flex h-8 md:h-10 w-8 md:w-10 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/40 rounded-full shadow-soft">
                  <BookOpen className="h-4 md:h-5 w-4 md:w-5" />
                </div>
                <h3 className="font-display text-lg md:text-xl font-bold tracking-wide text-histo-dark">Featured Era</h3>
              </div>

              <div className="border border-histo-dark/10 bg-white/50 p-4 md:p-6 rounded-[2px] flex flex-col items-center text-center">
                <div className="mb-3 md:mb-4 flex h-10 md:h-14 w-10 md:w-14 items-center justify-center rounded-full border border-histo-copper/30 bg-white text-histo-copper shadow-soft">
                  <Crown className="h-5 md:h-6 w-5 md:w-6" />
                </div>
                
                <h4 className="font-display text-lg md:text-2xl font-bold text-histo-dark mb-2">Renaissance Era</h4>
                <p className="font-body text-sm text-histo-ink/80 leading-relaxed mb-4 md:mb-6">
                  Explore the cultural and artistic bridge between the Middle Ages and modern history, marked by a revival of classical learning.
                </p>
                
                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="font-ui text-xs font-bold tracking-widest uppercase border-b-2 border-histo-copper text-histo-copper pb-1 hover:text-histo-dark hover:border-histo-dark transition-colors duration-200"
                >
                  Discover More
                </motion.a>
              </div>
            </motion.section>

            {/* Manuscript Snippet (Quote) */}
            <motion.section 
              variants={customItemVariants}
              whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.01, boxShadow: 'var(--shadow-medium)' }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.995 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="border border-histo-dark/10 bg-white p-4 md:p-6 shadow-soft rounded-[4px] flex flex-col relative overflow-hidden"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-histo-gold/30" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-histo-gold/30" />
              
              <div className="mb-3 md:mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[3px] text-histo-copper font-ui font-semibold">Manuscript Snippet</span>
                <Bookmark className="h-4 w-4 text-histo-copper/50" />
              </div>

              <blockquote className="font-display text-base md:text-lg italic text-histo-dark leading-relaxed text-center my-3 md:my-4 relative">
                &ldquo;History is a gallery of pictures in which there are few originals and many copies.&rdquo;
              </blockquote>
              <cite className="font-ui text-xs font-semibold text-center text-histo-ink/60 not-italic block uppercase tracking-widest mt-2">
                — Alexis de Tocqueville
              </cite>
            </motion.section>

          </div>
          
        </main>
    </motion.div>

    
    {chatModalOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => setChatModalOpen(false)}
      >
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-histo-dark/10 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-histo-dark flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-histo-copper" />
              Chat
            </h2>
            <button
              onClick={() => setChatModalOpen(false)}
              className="p-1 rounded text-histo-ink/50 hover:text-histo-copper hover:bg-histo-cream transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Tab Navigation */}
            <div className="border-b border-histo-dark/10 flex">
              {['Personal', 'Groups'].map((tab) => (
                <button
                  key={tab}
                  className="flex-1 py-3 px-4 text-sm font-ui font-medium uppercase tracking-wider transition-colors border-b-2 border-transparent hover:text-histo-copper hover:border-histo-copper/50"
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Personal Chats Section */}
            <div className="flex-1 p-4 overflow-y-auto">
              <p className="text-center text-histo-ink/40 py-8 font-body text-sm">
                No personal chats yet
              </p>
              <p className="text-center text-histo-ink/30 text-xs font-ui mb-4">
                Start a conversation from a user's profile
              </p>
            </div>

            {/* Groups Section */}
            <div className="p-4 border-t border-histo-dark/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-bold text-histo-dark">Study Groups</h3>
                <button className="p-2 bg-histo-copper text-white rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Create
                </button>
              </div>
              <p className="text-center text-histo-ink/40 py-8 font-body text-sm">
                No groups yet
              </p>
              <p className="text-center text-histo-ink/30 text-xs font-ui mb-3">
                Create a group to study together
              </p>
              <button className="w-full bg-histo-copper text-white py-2 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors">
                Create Your First Group
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
    </>
  );
}
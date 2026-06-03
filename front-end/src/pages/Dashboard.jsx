import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellIcon,
  BookOpenIcon,
  BookmarkIcon,
  CalendarIcon,
  CogIcon,
  CrownIcon,
  FilterIcon,
  HeartIcon,
  BulbIcon,
  SearchIcon,
  TimeIcon,
  UserIcon,
} from '../components/MotionIcons';

const sidebarItems = [
  { to: '/quiz', icon: BulbIcon, label: 'Quiz' },
  { to: '#', icon: HeartIcon, label: 'Favorites' },
  { to: '#', icon: BookmarkIcon, label: 'Bookmarks' },
  { to: '#', icon: CogIcon, label: 'Settings' },
];

const headerIcons = [
  { icon: FilterIcon, label: 'Filters' },
  { icon: BellIcon, label: 'Notifications' },
  { icon: CalendarIcon, label: 'Historical Calendar' },
];

const newsSeed = [
  { 
    title: 'On This Day: March 17', 
    content: 'Historical events that happened on this day will appear here. In 461 AD, Saint Patrick, the patron saint of Ireland, died in Saul.' 
  },
  { 
    title: 'March 17, 1801', 
    content: 'The Union Parliament meets for the first time, following the Act of Union between Great Britain and Ireland.' 
  },
  { 
    title: 'March 17, 1959', 
    content: 'Tenzin Gyatso, the 14th Dalai Lama, flees Tibet for India during the Tibetan uprising.' 
  }
];

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 16,
    },
  },
};

export default function DashboardPage() {
  const [newsItems, setNewsItems] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [activeNav, setActiveNav] = useState('Home');

  useEffect(() => {
    const timer = window.setTimeout(() => setNewsItems(newsSeed), 1000);
    const handleScroll = () => setScrolled(window.scrollY > 10);

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageVariants}
      className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture"
    >
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col items-center bg-[#1c3144] py-6 text-white border-r border-white/5 shadow-[4px_0_10px_rgba(0,0,0,0.05)]">
        <Link 
          to="/loginpg" 
          className="group relative mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-histo-medium border border-white/10 text-white transition duration-300 hover:bg-histo-gold hover:text-histo-dark hover:border-histo-gold shadow-soft"
        >
          <UserIcon className="h-6 w-6" />
          <span className="pointer-events-none absolute left-[66px] z-10 whitespace-nowrap rounded-[2px] bg-histo-dark px-3 py-2 text-xs font-medium text-white opacity-0 shadow-medium transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">Profile</span>
        </Link>
        <div className="mb-6 h-[1px] w-10 bg-white/10" />
        <div className="flex flex-col items-center gap-6">
          {sidebarItems.map(({ to, icon: Icon, label }) => (
            <Link 
              key={label} 
              to={to} 
              onMouseEnter={() => setHoveredItem(label)}
              onMouseLeave={() => setHoveredItem(null)}
              className="group relative flex h-12 w-12 items-center justify-center rounded-[4px] text-white/80 hover:text-histo-dark transition-colors duration-200"
            >
              {hoveredItem === label && (
                <motion.div
                  layoutId="sidebar-hover-bg"
                  className="absolute inset-0 bg-histo-gold rounded-[4px] -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 25 }}
                />
              )}
              <Icon className="h-6 w-6 transition-transform duration-300 group-hover:scale-105" />
              <span className="pointer-events-none absolute left-[66px] z-10 whitespace-nowrap rounded-[2px] bg-histo-dark px-3 py-2 text-xs font-medium text-white opacity-0 shadow-medium transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">{label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Main Panel Wrapper */}
      <div className="ml-20 flex min-h-screen flex-col">
        {/* Header */}
        <header className={`sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 px-8 py-4 text-white border-b transition-all duration-300 ${scrolled ? 'bg-histo-dark/95 border-white/10 backdrop-blur-md shadow-soft' : 'bg-histo-dark border-transparent'}`}>
          <h1 className="font-display text-2xl font-bold tracking-[4px] text-histo-paper uppercase">HISTOFACTS</h1>

          <nav className="flex gap-6">
            {['Home', 'About', 'Help'].map((item) => (
              <Link
                key={item}
                to={item === 'Home' ? '/home' : '#'}
                className="relative px-3 py-1.5 text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors duration-200"
                onClick={() => setActiveNav(item)}
              >
                {activeNav === item && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute left-0 right-0 -bottom-1 h-0.5 bg-histo-gold"
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  />
                )}
                {item}
              </Link>
            ))}
          </nav>

          <div className="flex w-full max-w-[240px] focus-within:max-w-[320px] items-center border border-white/20 bg-white/5 px-4 py-2 transition-all duration-300 md:w-auto rounded-[2px]">
            <input type="text" placeholder="Search historical facts..." className="w-full bg-transparent text-sm text-histo-paper outline-none placeholder:text-white/40 font-ui" />
            <SearchIcon className="ml-2 h-4 w-4 text-histo-paper/60" />
          </div>

          <div className="flex gap-4">
            {headerIcons.map(({ icon: Icon, label }) => (
              <div 
                key={label} 
                className="group relative flex h-10 w-10 cursor-pointer items-center justify-center border border-white/10 hover:border-histo-gold rounded-full transition-colors duration-300"
              >
                <Icon className="h-5 w-5 text-histo-paper/85 transition-colors duration-300 group-hover:text-histo-gold" />
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 translate-y-[-10px] whitespace-nowrap rounded-[2px] bg-histo-dark px-3 py-2 text-xs font-medium text-white opacity-0 shadow-medium transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">{label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Content Layout */}
        <main className="flex-1 p-6 md:p-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-10 gap-8">
          
          {/* Left Column: Feature Banner & Events Feed (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            
            {/* Feature Banner (Hero) */}
            <motion.section 
              variants={itemVariants}
              whileHover="hover"
              whileTap="tap"
              className="relative overflow-hidden border border-histo-dark/10 bg-histo-dark text-histo-paper shadow-medium p-1 rounded-[4px] cursor-pointer"
            >
              <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
              <div className="border-2 border-double border-histo-gold/30 p-8 md:p-12 relative z-10 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-[4px] text-histo-gold font-ui font-semibold mb-3">Chronicle Feature</span>
                <h2 className="mb-6 font-display text-xl font-bold tracking-[2px] text-histo-paper uppercase opacity-80">HISTOFACTS</h2>
                
                <div className="max-w-2xl my-4">
                  <span className="text-sm font-ui text-histo-gold tracking-widest uppercase font-semibold block mb-2">Today in History</span>
                  <p className="font-display text-3xl md:text-4xl font-bold leading-tight text-white mb-6">
                    March 17, 461 AD — Death of Saint Patrick
                  </p>
                  <p className="font-body text-histo-paper/70 text-base leading-relaxed mb-8 italic">
                    Saint Patrick, the patron saint of Ireland, dies in Saul. His life, mission, and legend would shape the spiritual and cultural landscape of Ireland and the Western world for centuries to come.
                  </p>
                </div>

                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block border border-histo-gold bg-histo-gold text-histo-dark hover:bg-transparent hover:text-histo-gold font-ui text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-[2px] shadow-soft transition-colors duration-300"
                >
                  Explore Significance
                </motion.a>
              </div>
            </motion.section>

            {/* Historical Events Feed */}
            <motion.section 
              variants={itemVariants}
              className="border border-histo-dark/10 bg-histo-cream p-6 shadow-soft rounded-[4px]"
            >
              <div className="mb-6 flex items-center justify-between border-b border-histo-dark/10 pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/40 rounded-full shadow-soft">
                    <TimeIcon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-wide text-histo-dark">Historical Events</h3>
                </div>
                <span className="text-xs font-ui tracking-wider text-histo-ink/60 uppercase">Chronology</span>
              </div>

              <div className="min-h-[120px] flex flex-col gap-4">
                {newsItems.length === 0 ? (
                  <div className="py-8 text-center text-sm font-body italic text-histo-ink/60">Loading today&apos;s chronicle events...</div>
                ) : (
                  <motion.div 
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.1 } }
                    }}
                    className="flex flex-col gap-4"
                  >
                    {newsItems.map((item, idx) => (
                      <motion.article 
                        key={item.title + idx}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 120 } }
                        }}
                        whileHover={{ x: 6, transition: { type: "spring", stiffness: 300, damping: 15 } }}
                        className="border-l border-histo-gold/50 bg-white/40 hover:bg-white/70 p-5 shadow-soft transition-colors duration-200 rounded-[2px] cursor-pointer"
                      >
                        <h4 className="mb-2 font-display text-lg font-bold text-histo-dark tracking-wide">{item.title}</h4>
                        <p className="font-body text-sm text-histo-ink leading-relaxed">{item.content}</p>
                      </motion.article>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.section>
            
          </div>

          {/* Right Column: Featured Period & Quote (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            
            {/* Featured Era */}
            <motion.section 
              variants={itemVariants}
              className="border border-histo-dark/10 bg-histo-cream p-6 shadow-soft rounded-[4px] flex flex-col"
            >
              <div className="mb-6 flex items-center gap-4 border-b border-histo-dark/10 pb-4">
                <div className="flex h-10 w-10 items-center justify-center border border-histo-dark/20 text-histo-dark bg-white/40 rounded-full shadow-soft">
                  <BookOpenIcon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold tracking-wide text-histo-dark">Featured Era</h3>
              </div>

              <div className="border border-histo-dark/10 bg-white/50 p-6 rounded-[2px] flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-histo-copper/30 bg-white text-histo-copper shadow-soft">
                  <CrownIcon className="h-6 w-6" />
                </div>
                
                <h4 className="font-display text-2xl font-bold text-histo-dark mb-2">Renaissance Era</h4>
                <p className="font-body text-sm text-histo-ink/80 leading-relaxed mb-6">
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
              variants={itemVariants}
              className="border border-histo-dark/10 bg-white p-6 shadow-soft rounded-[4px] flex flex-col relative overflow-hidden"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-histo-gold/30" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-histo-gold/30" />
              
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[3px] text-histo-copper font-ui font-semibold">Manuscript Snippet</span>
                <BookmarkIcon className="h-4 w-4 text-histo-copper/50" />
              </div>

              <blockquote className="font-display text-lg italic text-histo-dark leading-relaxed text-center my-4 relative">
                &ldquo;History is a gallery of pictures in which there are few originals and many copies.&rdquo;
              </blockquote>
              <cite className="font-ui text-xs font-semibold text-center text-histo-ink/60 not-italic block uppercase tracking-widest mt-2">
                — Alexis de Tocqueville
              </cite>
            </motion.section>

          </div>
          
        </main>
      </div>
    </motion.div>
  );
}
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Coins,
  PanelLeft,
  MessageSquare,
  Settings,
  Users,
  Sparkles,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { useAiNotes } from '../contexts/AiNotesContext';
import NotificationDropdown from './NotificationDropdown';
import UserAvatar from './UserAvatar';

const NAV_ITEMS = [
  { label: 'Home', path: '/home', match: (p) => p === '/' || p.startsWith('/home') },
  { label: 'Community', path: '/feed', match: (p) => p.startsWith('/feed') },
  { label: 'Quiz', path: '/quiz', match: (p) => p.startsWith('/quiz') },
  { label: 'AI Notes', path: '/notes', match: (p) => p.startsWith('/notes') },
];

// Preload route components on hover/focus to eliminate lazy-loading latency
const ROUTE_PRELOADERS = {
  '/home': () => import('../pages/Dashboard'),
  '/feed': () => import('../pages/FeedPage'),
  '/quiz': () => import('../pages/QuizPage'),
  '/notes': () => import('../pages/NotesPage'),
};

const prefetchRoute = (path) => {
  const preloader = ROUTE_PRELOADERS[path];
  if (preloader) {
    preloader();
  }
};

/**
 * Isolated AI Notes Library Toggle
 * Only subscribes to AiNotesContext when rendered on /notes
 */
const AiNotesLibraryToggle = memo(function AiNotesLibraryToggle() {
  const aiNotes = useAiNotes();
  if (!aiNotes) return null;

  return (
    <button
      type="button"
      onClick={aiNotes.toggleSidebar}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui font-semibold rounded-lg transition-all duration-150 border cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 ${
        aiNotes.sidebarOpen
          ? 'bg-histo-gold/20 text-histo-gold border-histo-gold/60 shadow-xs'
          : 'bg-white/5 text-histo-paper/80 hover:text-white hover:bg-white/10 border-white/10'
      }`}
      title={aiNotes.sidebarOpen ? 'Hide Notes Library' : 'Show Notes Library'}
      aria-label={aiNotes.sidebarOpen ? 'Hide Notes Library' : 'Show Notes Library'}
      aria-pressed={aiNotes.sidebarOpen}
    >
      <PanelLeft className="h-4 w-4 shrink-0 transition-transform duration-150" />
      <span className="hidden sm:inline">Library</span>
    </button>
  );
});

/**
 * Isolated AI Notes Wallet and Shop controls
 * Separates wallet balance info from the actionable shop button
 */
const AiNotesWalletAndShop = memo(function AiNotesWalletAndShop() {
  const aiNotes = useAiNotes();
  if (!aiNotes) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Wallet Balance Badge */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-histo-gold/30 rounded-full font-ui text-xs font-medium text-histo-gold shadow-2xs select-none"
        title={`Histoins: ${aiNotes.wallet.histoin_balance.toLocaleString()} coins. Earn more from quizzes and daily logins to refill study credits.`}
        aria-label={`Histoins: ${aiNotes.wallet.histoin_balance.toLocaleString()} coins`}
      >
        <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="font-mono text-[11px] sm:text-xs">
          {aiNotes.wallet.histoin_balance.toLocaleString()} 🪙
        </span>
      </div>

      {/* Shop Action Button */}
      <button
        type="button"
        onClick={aiNotes.openShop}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-histo-gold/20 hover:bg-histo-gold/30 active:scale-95 border border-histo-gold/50 hover:border-histo-gold rounded-full text-xs font-ui font-bold text-histo-gold transition-all duration-150 cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50"
        title="Token Shop: Refill your daily AI study credits with earned Histoins"
        aria-label="Open Token Shop"
      >
        <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
        <span>Shop</span>
      </button>
    </div>
  );
});

/**
 * Isolated Chat Button
 * Prevents chat polling from re-rendering the whole Navbar
 */
const ChatNavbarButton = memo(function ChatNavbarButton() {
  const chatContext = useChat();
  if (!chatContext) return null;
  const totalUnread = chatContext.totalUnreadCount || 0;

  return (
    <button
      type="button"
      onClick={chatContext.toggleSidebar}
      className={`relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center border rounded-full transition-all duration-150 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 ${
        chatContext.isOpen
          ? 'border-histo-gold bg-histo-gold/20 text-histo-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]'
          : 'border-white/10 hover:border-histo-gold/60 text-histo-paper hover:text-white hover:bg-white/5'
      }`}
      aria-label="Scholar Chat"
      title="Scholar Chat"
    >
      <MessageSquare className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
      {totalUnread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-histo-gold text-[10px] font-bold text-histo-dark font-ui leading-none shadow-xs">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  );
});

/**
 * Smooth horizontal auto-scrolling marquee ticker for navbar profile username.
 * - Stays static when text fits comfortably within container.
 * - When username overflows, smoothly continuously scrolls right -> left.
 * - Seamlessly loops with an identical clone without visible jump.
 * - Pauses on hover/focus.
 * - Accessible: respects prefers-reduced-motion with full username in title and aria-label.
 */
const NavbarProfileTicker = memo(function NavbarProfileTicker({ username, tag }) {
  const containerRef = useRef(null);
  const usernameRef = useRef(null);
  const tagRef = useRef(null);

  // Only the username portion scrolls; tag stays fixed
  const displayUsername = username || '';
  const displayTag = tag ? `#${tag}` : '';
  const fullDisplay = displayUsername + displayTag;

  const [isOverflowing, setIsOverflowing] = useState(() => displayUsername.length > 10);
  const [measuredWidth, setMeasuredWidth] = useState(() => displayUsername.length * 8);

  useEffect(() => {
    const usernameEl = usernameRef.current;
    const container = containerRef.current;
    const tagEl = tagRef.current;
    if (!usernameEl || !container) return;

    const checkOverflow = () => {
      const containerW = container.clientWidth || 116;
      const tagW = tagEl ? tagEl.getBoundingClientRect().width : 0;
      const availableW = containerW - tagW;
      const textW = usernameEl.getBoundingClientRect().width;
      setMeasuredWidth(textW);
      setIsOverflowing(textW > availableW - 2);
    };

    checkOverflow();
    document.fonts?.ready?.then?.(checkOverflow);
    const timer = setTimeout(checkOverflow, 120);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(container);
    } else {
      window.addEventListener('resize', checkOverflow);
    }

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', checkOverflow);
    };
  }, [displayUsername, displayTag]);

  const duration = useMemo(() => {
    const width = measuredWidth > 0 ? measuredWidth : displayUsername.length * 8;
    return Math.max(6, Math.round(((width + 28) / 22) * 10) / 10);
  }, [measuredWidth, displayUsername]);

  return (
    <div
      ref={containerRef}
      className="flex items-center w-[116px] max-w-[116px] h-[18px] select-none"
      title={fullDisplay}
      aria-label={fullDisplay}
    >
      {/* Username area — scrolls only when overflowing */}
      <div
        className={`relative flex-1 min-w-0 h-full overflow-hidden ${
          isOverflowing ? 'profile-ticker-mask' : ''
        }`}
      >
        {/* Invisible measure element for real username width */}
        <span
          ref={usernameRef}
          className="absolute -left-[9999px] -top-[9999px] invisible whitespace-nowrap text-xs font-ui font-semibold tracking-wide pointer-events-none"
          aria-hidden="true"
        >
          {displayUsername}
        </span>

        {isOverflowing ? (
          <div
            className="profile-ticker-track flex items-center"
            style={{ animationDuration: `${duration}s` }}
          >
            <div className="shrink-0 flex items-center pr-7">
              <span className="text-xs font-ui font-semibold tracking-wide text-white group-hover:text-histo-gold transition-colors duration-150 whitespace-nowrap">
                {displayUsername}
              </span>
            </div>
            <div
              className="profile-ticker-clone shrink-0 flex items-center pr-7"
              aria-hidden="true"
            >
              <span className="text-xs font-ui font-semibold tracking-wide text-white group-hover:text-histo-gold transition-colors duration-150 whitespace-nowrap">
                {displayUsername}
              </span>
            </div>
          </div>
        ) : (
          <span className="block text-xs font-ui font-semibold tracking-wide text-white group-hover:text-histo-gold transition-colors duration-150 whitespace-nowrap">
            {displayUsername}
          </span>
        )}
      </div>

      {/* Tag — always fixed, never scrolls */}
      {displayTag && (
        <span
          ref={tagRef}
          className="shrink-0 text-xs font-ui font-semibold tracking-wide text-white/50 whitespace-nowrap"
        >
          {displayTag}
        </span>
      )}
    </div>
  );
});

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const isNotesRoute = location.pathname.startsWith('/notes');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active route index calculation with optimistic click response
  const routeIndex = NAV_ITEMS.findIndex((item) => item.match(location.pathname));
  const [optimisticIndex, setOptimisticIndex] = useState(null);
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  // Clear optimistic override as soon as router updates pathname (React standard pattern)
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setOptimisticIndex(null);
  }

  const activeIndex = optimisticIndex !== null ? optimisticIndex : routeIndex;

  const profileRef = useRef(null);

  // Handle click outside to close profile dropdown
  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  // Handle Escape key to close any open dropdowns or mobile menu
  useEffect(() => {
    if (!profileMenuOpen && !mobileMenuOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [profileMenuOpen, mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full bg-histo-dark text-white border-b border-white/10 shadow-medium min-h-[64px] sm:min-h-[72px] shrink-0 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-3 sm:gap-4 relative">

        {/* ── 1. Brand & Emblem ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/home"
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 rounded-sm active:scale-95 transition-transform duration-100"
            aria-label="HistoFacts Home"
            onPointerEnter={() => prefetchRoute('/home')}
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-histo-gold/20 border border-histo-gold/50 group-hover:border-histo-gold flex items-center justify-center text-histo-gold transition-all duration-200 shadow-soft group-hover:scale-105">
              <BookOpen className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <span className="font-display text-xl sm:text-2xl font-bold tracking-[3px] text-histo-paper uppercase group-hover:text-histo-gold transition-colors duration-200">
              HISTOFACTS
            </span>
          </Link>

          {/* AI Notes Library Toggle (context-isolated) */}
          {isNotesRoute && <AiNotesLibraryToggle />}
        </div>

        {/* ── 2. Primary Navigation Links (Desktop with Hardware-Accelerated Sliding Indicator) ── */}
        <nav
          className="hidden lg:grid grid-cols-4 p-1 rounded-full bg-white/5 border border-white/10 shadow-inner w-[370px] xl:w-[410px] relative pointer-events-auto"
          aria-label="Main Navigation"
        >
          {/* Persistent single sliding active indicator: GPU-composited CSS translate for 0ms lag */}
          {activeIndex !== -1 && (
            <div
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-histo-gold/20 via-histo-gold/15 to-histo-gold/20 border border-histo-gold/45 shadow-[0_0_12px_rgba(212,175,55,0.22)] pointer-events-none"
              style={{
                left: '4px',
                width: 'calc((100% - 8px) / 4)',
                transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
                transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform',
              }}
            >
              <span className="absolute -bottom-1 left-2.5 right-2.5 h-[2px] bg-gradient-to-r from-transparent via-histo-gold to-transparent rounded-full shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
            </div>
          )}

          {NAV_ITEMS.map((item, index) => {
            const isActive = activeIndex === index;
            return (
              <Link
                key={item.label}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                onClick={() => setOptimisticIndex(index)}
                className={`relative z-10 py-1.5 text-xs font-ui tracking-wider uppercase font-semibold text-center rounded-full select-none flex items-center justify-center transition-colors duration-150 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 ${
                  isActive
                    ? 'text-histo-gold font-bold'
                    : 'text-histo-paper/75 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── 3. Hierarchy: Primary Nav | Contextual Actions | User Actions | Profile ── */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Contextual Tier on /notes: Separator + Wallet + Shop */}
          {isNotesRoute && (
            <>
              <div className="h-5 w-px bg-white/20 hidden lg:block" aria-hidden="true" />
              <AiNotesWalletAndShop />
            </>
          )}

          {/* UserActions: Notifications & Chat */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {user && <NotificationDropdown />}
            <ChatNavbarButton />
          </div>

          {/* Vertical Divider before Profile */}
          <div className="h-6 w-px bg-white/20" aria-hidden="true" />

          {/* Scholar Profile / Sign In */}
          <div className="relative" ref={profileRef}>
            {user ? (
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 group cursor-pointer bg-transparent border-none outline-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 rounded-full active:scale-95 transition-transform duration-100"
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
                aria-label="User Account Menu"
              >
                <UserAvatar
                  user={user}
                  size="md"
                  className="group-hover:ring-2 group-hover:ring-histo-gold transition-all duration-150"
                />
                <div className="hidden xl:flex flex-col text-left">
                  <NavbarProfileTicker username={user.username} tag={user.tag} />
                  <span className="text-[10px] font-ui text-histo-gold/80 tracking-wider">
                    Scholar Account
                  </span>
                </div>
              </button>
            ) : (
              <Link
                to="/loginpg"
                className="flex items-center gap-2 px-3.5 py-1.5 bg-histo-copper hover:bg-histo-dark border border-histo-copper/50 text-white rounded-full text-xs font-ui font-semibold transition-all duration-150 active:scale-95"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {user && profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 top-full mt-2 w-64 bg-histo-dark border border-histo-gold/30 rounded-xl shadow-deep p-2 z-50"
                  role="menu"
                >
                  {/* User Profile Summary */}
                  <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                    <p className="font-display text-sm font-bold text-histo-paper">{user.username}</p>
                    <p className="font-ui text-xs text-histo-gold/80 font-mono">#{user.tag}</p>
                    <p className="font-ui text-[11px] text-white/50 truncate mt-0.5">{user.email}</p>
                  </div>

                  {/* Dropdown Navigation Links */}
                  <div className="space-y-0.5">
                    <Link
                      to="/notes"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-lg transition-colors flex items-center gap-2.5"
                      role="menuitem"
                    >
                      <Sparkles className="h-4 w-4 text-histo-gold/80" />
                      <span>AI Study Notes</span>
                    </Link>

                    <Link
                      to="/friends"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-lg transition-colors flex items-center gap-2.5"
                      role="menuitem"
                    >
                      <Users className="h-4 w-4 text-histo-gold/80" />
                      <span>Friends & Classmates</span>
                    </Link>

                    <Link
                      to="/groups"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-lg transition-colors flex items-center gap-2.5"
                      role="menuitem"
                    >
                      <Shield className="h-4 w-4 text-histo-gold/80" />
                      <span>Study Groups</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-lg transition-colors flex items-center gap-2.5"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 text-histo-gold/80" />
                      <span>Profile & Settings</span>
                    </Link>
                  </div>

                  <div className="h-px bg-white/10 my-1.5" />

                  {/* Log Out Button */}
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setProfileMenuOpen(false);
                      toast.info('Logged out successfully!');
                      navigate('/loginpg');
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-ui font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-red-400" />
                    <span>Log Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 4. Morphing Hamburger Mobile Menu Button ───────────────── */}
          <button
            type="button"
            className="lg:hidden flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center border border-white/15 hover:border-histo-gold/60 rounded-full transition-all duration-150 active:scale-95 shrink-0 text-histo-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-histo-gold/50 cursor-pointer"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            <div className="w-4.5 h-3.5 flex flex-col justify-between items-center relative pointer-events-none">
              <motion.span
                animate={mobileMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="w-4.5 h-0.5 bg-current rounded-full"
              />
              <motion.span
                animate={mobileMenuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.15 }}
                className="w-4.5 h-0.5 bg-current rounded-full"
              />
              <motion.span
                animate={mobileMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="w-4.5 h-0.5 bg-current rounded-full"
              />
            </div>
          </button>
        </div>
      </div>

      {/* ── 5. Responsive Mobile Menu Drawer (GPU transform/opacity for butter-smooth animation) ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="lg:hidden bg-histo-dark/98 backdrop-blur-md border-b border-white/10 px-4 py-4 shadow-deep z-50"
          >
            <div className="flex flex-col gap-1">
              {/* Primary Mobile Navigation Links */}
              {NAV_ITEMS.map((item) => {
                const isActive = item.match(location.pathname);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center justify-between text-sm font-ui tracking-wider uppercase py-2.5 px-3 rounded-lg transition-colors active:scale-[0.98] ${
                      isActive
                        ? 'text-histo-gold font-bold bg-white/10'
                        : 'text-histo-paper/85 hover:text-histo-gold hover:bg-white/5'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-histo-gold shadow-xs" />
                    )}
                  </Link>
                );
              })}

              {/* Secondary Navigation Links */}
              <div className="border-t border-white/10 pt-3 mt-2 flex flex-col gap-1">
                <Link
                  to="/friends"
                  className="flex items-center gap-2.5 text-xs font-ui text-histo-paper/90 hover:text-histo-gold hover:bg-white/5 px-3 py-2 rounded-lg transition-colors active:scale-[0.98]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Users className="h-4 w-4 text-histo-gold/80" />
                  <span>Friends & Classmates</span>
                </Link>

                <Link
                  to="/groups"
                  className="flex items-center gap-2.5 text-xs font-ui text-histo-paper/90 hover:text-histo-gold hover:bg-white/5 px-3 py-2 rounded-lg transition-colors active:scale-[0.98]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="h-4 w-4 text-histo-gold/80" />
                  <span>Study Groups</span>
                </Link>

                {user && (
                  <Link
                    to="/settings"
                    className="flex items-center gap-2.5 text-xs font-ui text-histo-paper/90 hover:text-histo-gold hover:bg-white/5 px-3 py-2 rounded-lg transition-colors active:scale-[0.98]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 text-histo-gold/80" />
                    <span>Profile & Settings</span>
                  </Link>
                )}

                {/* AI Notes Mobile Wallet Quick Access */}
                {isNotesRoute && (
                  <div className="flex items-center justify-between bg-histo-gold/10 border border-histo-gold/30 rounded-xl px-3 py-2 mt-2">
                    <AiNotesWalletAndShop />
                  </div>
                )}

                {user && (
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                      toast.info('Logged out successfully!');
                      navigate('/loginpg');
                    }}
                    className="flex items-center gap-2.5 text-xs font-ui font-semibold text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors mt-2 cursor-pointer text-left active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4 text-red-400" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

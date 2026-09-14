import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  MessageSquare,
  Settings,
  Filter,
  LogOut,
  Search,
  Users,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import NotificationDropdown from './NotificationDropdown';

const headerIcons = [
  { icon: Filter, label: 'Filters' },
  { icon: Calendar, label: 'Historical Calendar' },
];

const getAvatarSrc = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${baseUrl}${url}`;
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Chat sidebar — may not be available if not inside ChatProvider (e.g. landing page)
  let chatContext = null;
  try { chatContext = useChat(); } catch { /* not inside ChatProvider */ }
  const totalUnread = chatContext?.totalUnreadCount || 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const getActiveTab = () => {
    const p = location.pathname;
    if (p.startsWith('/quiz')) return 'Quiz';
    if (p.startsWith('/notes')) return 'AI Notes';
    if (p.startsWith('/feed')) return 'Feed';
    if (p.startsWith('/groups')) return 'Groups';
    if (p.startsWith('/friends')) return 'Friends';
    if (p.startsWith('/settings')) return 'Settings';
    return 'Home';
  };

  const activeTab = getActiveTab();

  const navLinks = [
    { label: 'Home', path: '/home' },
    { label: 'Quiz', path: '/quiz' },
    { label: 'Favorites', path: '/home#favorites' },
    { label: 'Bookmarks', path: '/home#bookmarks' },
    { label: 'AI Notes', path: '/notes' },
    { label: 'Feed', path: '/feed' },
  ];

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quiz?tab=personalized&topic=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-4 text-white bg-histo-dark border-b border-white/10 shadow-medium min-h-[72px] shrink-0">
      {/* Brand Title */}
      <Link to="/home" className="flex items-center gap-3 shrink-0 group">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-[4px] text-histo-paper uppercase group-hover:text-histo-gold transition-colors">
          HISTOFACTS
        </h1>
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-4 lg:gap-6">
        {navLinks.map((item) => {
          const isActive = activeTab === item.label;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`relative px-4 py-2 text-sm font-ui tracking-wider uppercase transition-colors duration-200 ${
                isActive
                  ? 'text-histo-gold font-bold'
                  : 'text-histo-paper/85 hover:text-histo-gold'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dashboard-nav-underline"
                  className="absolute left-0 right-0 -bottom-1 h-0.5 bg-histo-gold shadow-xs"
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Search Input & Action Icons */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search facts..."
            className="w-44 lg:w-56 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/20 focus:border-histo-gold/60 px-3.5 py-1.5 rounded-[2px] text-histo-paper placeholder:text-white/40 font-ui text-sm outline-none transition-all duration-300"
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-histo-paper/60 hover:text-histo-gold transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {/* Mobile Search Icon Toggle */}
        <button
          type="button"
          className="md:hidden flex h-10 w-10 items-center justify-center border border-white/10 hover:border-histo-gold rounded-full transition-colors duration-300"
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          aria-label="Toggle Search"
        >
          <Search className="h-4.5 w-4.5 text-histo-paper" />
        </button>

        {/* Notifications & Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {user && <NotificationDropdown />}

          {/* Chat Sidebar Toggle Button */}
          {chatContext && (
            <button
              type="button"
              onClick={chatContext.toggleSidebar}
              className={`relative flex h-10 w-10 items-center justify-center border rounded-full transition-colors duration-300 cursor-pointer ${
                chatContext.isOpen
                  ? 'border-histo-gold bg-histo-gold/20 text-histo-gold'
                  : 'border-white/10 hover:border-histo-gold text-histo-paper'
              }`}
              aria-label="Scholar Chat"
              title="Scholar Chat"
            >
              <MessageSquare className="h-4.5 w-4.5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-histo-gold text-[10px] font-bold text-histo-dark font-ui leading-none shadow-xs">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          )}

          {headerIcons.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                type="button"
                className="hidden sm:flex h-10 w-10 items-center justify-center border border-white/10 hover:border-histo-gold rounded-full transition-colors duration-300 group cursor-pointer"
                aria-label={item.label}
                title={item.label}
              >
                <Icon className="h-4.5 w-4.5 text-histo-paper group-hover:text-histo-gold transition-colors duration-300" />
              </button>
            );
          })}
        </div>

        {/* User Profile Pill / Login */}
        <div className="relative border-l border-white/15 pl-2 sm:pl-3">
          {user ? (
            <button
              type="button"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2.5 group cursor-pointer bg-transparent border-none outline-none text-left"
            >
              <div className="h-10 w-10 rounded-full bg-histo-gold/20 border border-histo-gold/50 group-hover:border-histo-gold flex items-center justify-center text-histo-gold font-display font-bold text-base transition-colors duration-300 shadow-soft overflow-hidden">
                {user.avatar_url ? (
                  <img src={getAvatarSrc(user.avatar_url)} alt={user.username} className="h-full w-full object-cover" />
                ) : (
                  user.username ? user.username[0].toUpperCase() : 'U'
                )}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-ui font-semibold tracking-wide text-white group-hover:text-histo-gold transition-colors duration-200">
                  {user.tag ? `${user.username}#${user.tag}` : user.username}
                </span>
                <span className="text-[11px] font-ui text-histo-gold/80 tracking-wider">
                  Scholar Account
                </span>
              </div>
            </button>
          ) : (
            <Link to="/loginpg" className="flex items-center gap-2 group cursor-pointer">
              <div className="h-10 w-10 rounded-full bg-histo-medium border border-white/20 group-hover:border-histo-gold flex items-center justify-center text-white transition-colors duration-300">
                <Users className="h-4.5 w-4.5 text-histo-paper group-hover:text-histo-gold" />
              </div>
              <span className="hidden sm:inline text-sm font-ui font-medium tracking-wide text-white/95 group-hover:text-histo-gold">
                Sign In
              </span>
            </Link>
          )}

          {/* Profile Dropdown Menu */}
          <AnimatePresence>
            {user && profileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-3 w-60 bg-histo-dark border border-histo-gold/30 rounded-[4px] shadow-deep p-2 z-50 animate-fade-in"
              >
                {/* User Info */}
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="font-display text-sm font-bold text-histo-paper">{user.username}</p>
                  <p className="font-ui text-xs text-histo-gold/80 font-mono">#{user.tag}</p>
                  <p className="font-ui text-[10px] text-white/50 truncate mt-0.5">{user.email}</p>
                </div>

                {/* Dropdown Links */}
                <Link
                  to="/notes"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <Sparkles className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>AI Notes & Tokens</span>
                </Link>

                <Link
                  to="/friends"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <Users className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>Friends & Scholars</span>
                </Link>

                <Link
                  to="/feed"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <MessageSquare className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>Community Feed</span>
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <Settings className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>Profile & Settings</span>
                </Link>

                <div className="h-[1px] bg-white/10 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setProfileMenuOpen(false);
                    toast.info('Logged out successfully!');
                    navigate('/loginpg');
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm font-ui font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-[2px] transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="h-4.5 w-4.5 text-red-400" />
                  <span>Log Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="lg:hidden flex h-10 w-10 items-center justify-center border border-white/10 hover:border-histo-gold rounded-full transition-colors duration-300 shrink-0"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden absolute top-full left-0 right-0 overflow-hidden bg-histo-dark border-b border-white/10 py-4 px-4 shadow-deep z-50"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`text-sm font-ui tracking-wider uppercase py-3 ${
                    activeTab === item.label
                      ? 'text-histo-gold font-bold'
                      : 'text-histo-paper/85 hover:text-histo-gold'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                <Link
                  to="/friends"
                  className="flex items-center gap-2 text-sm font-ui text-histo-paper hover:text-histo-gold transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Users className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>Friends & Scholars</span>
                </Link>
                <Link
                  to="/feed"
                  className="flex items-center gap-2 text-sm font-ui text-histo-paper hover:text-histo-gold transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageSquare className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>Community Feed</span>
                </Link>
                <Link
                  to="/notes"
                  className="flex items-center gap-2 text-sm font-ui text-histo-paper hover:text-histo-gold transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles className="h-4.5 w-4.5 text-histo-gold/80" />
                  <span>AI Notes</span>
                </Link>
                {user && (
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 text-sm font-ui text-histo-paper hover:text-histo-gold transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="h-4.5 w-4.5 text-histo-gold/80" />
                    <span>Profile & Settings</span>
                  </Link>
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
                    className="flex items-center gap-2 text-sm font-ui font-semibold text-red-400 hover:text-red-300 transition-colors py-2 cursor-pointer text-left"
                  >
                    <LogOut className="h-4.5 w-4.5 text-red-400" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Search Panel */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden absolute top-full left-0 right-0 overflow-hidden bg-histo-dark border-b border-white/10 py-4 px-4 z-50"
          >
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facts..."
                className="flex-1 bg-white/5 border border-white/20 px-4 py-3 rounded-[2px] text-histo-paper placeholder:text-white/40 font-ui text-sm outline-none"
              />
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center bg-histo-copper text-white rounded-[2px] hover:bg-histo-dark transition-colors cursor-pointer"
              >
                <Search className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-10 w-10 items-center justify-center text-histo-paper/60 hover:text-histo-gold transition-colors cursor-pointer"
                aria-label="Close search"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

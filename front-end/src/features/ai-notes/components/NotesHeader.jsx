import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Menu,
  X,
  BookOpen,
  Sparkles,
  Coins,
  ArrowLeft,
  ShoppingBag,
  LogOut,
} from 'lucide-react';

export default function NotesHeader({
  sidebarOpen,
  onToggleSidebar,
  wallet,
  onOpenShop,
  user,
  profileMenuOpen,
  onToggleProfileMenu,
  onCloseProfileMenu,
  logout,
}) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-histo-dark text-white border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 shrink-0 shadow-medium min-h-[72px]">
      {/* Left: Brand Logo & Sidebar Toggle */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="p-2.5 rounded-[4px] bg-white/10 text-white hover:bg-histo-copper hover:text-white transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer border border-white/10"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide notes library' : 'Show notes library'}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open notes library'}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to="/home" className="flex items-center gap-2.5 group shrink-0">
          <div className="h-10 w-10 rounded-full bg-histo-gold/20 border border-histo-gold/50 group-hover:border-histo-gold flex items-center justify-center text-histo-gold transition-colors shadow-soft">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-display text-lg sm:text-xl font-bold tracking-[3px] text-histo-paper uppercase hidden sm:inline-block">
            HISTOFACTS
          </span>
        </Link>

        <div className="h-5 w-[1px] bg-white/20 hidden md:block" />

        <div className="hidden md:flex items-center gap-2 truncate">
          <span className="font-display text-sm font-bold text-histo-paper truncate">
            AI Notes Assistant
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-histo-gold/20 text-histo-gold border border-histo-gold/30 rounded-full text-[10px] font-ui uppercase tracking-wider font-bold shrink-0">
            <Sparkles className="h-3 w-3" />
            GPT-4o
          </span>
        </div>
      </div>

      {/* Center: Desktop Navigation Bar */}
      <nav className="hidden lg:flex items-center gap-6">
        {[
          { label: 'Home', path: '/home' },
          { label: 'Quiz', path: '/quiz' },
          { label: 'AI Notes', path: '/notes' },
          { label: 'Feed', path: '/feed' },
          { label: 'Groups', path: '/groups' },
          { label: 'Friends', path: '/friends' },
        ].map((item) => {
          const isActive = item.label === 'AI Notes';
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`relative px-3 py-2 text-sm font-ui tracking-wider uppercase transition-colors duration-200 ${
                isActive ? 'text-histo-gold font-bold' : 'text-histo-paper/80 hover:text-histo-gold'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="notes-nav-underline"
                  className="absolute left-0 right-0 -bottom-1 h-0.5 bg-histo-gold"
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Currency Badges, Shop Button & Scholar Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Histoin & Token Balance Shop Pill */}
        <button
          type="button"
          onClick={onOpenShop}
          className="flex items-center gap-2 px-4 py-2 bg-histo-gold/15 hover:bg-histo-gold/25 border border-histo-gold/40 hover:border-histo-gold rounded-full font-ui text-sm font-bold text-histo-gold transition-all shadow-soft active:scale-95 cursor-pointer"
          title="Open Token Shop"
        >
          <Coins className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{wallet.histoin_balance.toLocaleString()} 🪙</span>
          <span className="hidden sm:inline-block px-2 py-0.5 bg-histo-gold/30 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
            Shop
          </span>
        </button>

        {/* Scholar Account Avatar & Profile Menu */}
        <div className="relative border-l border-white/15 pl-3">
          {user ? (
            <button
              type="button"
              onClick={onToggleProfileMenu}
              className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none outline-none group text-left"
            >
              <div className="h-10 w-10 rounded-full bg-histo-gold/20 border border-histo-gold/50 group-hover:border-histo-gold flex items-center justify-center text-histo-gold font-display font-bold text-sm shadow-soft transition-colors">
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden xl:flex flex-col">
                <span className="text-sm font-ui font-semibold text-white group-hover:text-histo-gold transition-colors truncate max-w-[110px]">
                  {user.username}
                </span>
                <span className="text-[11px] font-ui text-histo-gold/80 font-medium tracking-wide">
                  Scholar #{user.tag || '0000'}
                </span>
              </div>
            </button>
          ) : (
            <Link to="/loginpg" className="px-4 py-2 rounded-[4px] bg-histo-copper text-white text-sm font-ui font-bold hover:bg-histo-dark transition-colors">
              Sign In
            </Link>
          )}

          {user && profileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-histo-dark text-white border border-histo-gold/30 rounded-[4px] shadow-deep p-2 z-50 animate-fade-in">
              <div className="px-3 py-2 border-b border-white/10 mb-1">
                <p className="font-display text-sm font-bold text-histo-paper">{user.username}</p>
                <p className="font-ui text-[10px] text-histo-gold/80 font-mono">#{user.tag}</p>
              </div>
              <Link
                to="/home"
                onClick={onCloseProfileMenu}
                className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-histo-gold/80" />
                <span>Dashboard Home</span>
              </Link>
              <Link
                to="/quiz"
                onClick={onCloseProfileMenu}
                className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5"
              >
                <Sparkles className="h-4.5 w-4.5 text-histo-gold/80" />
                <span>Quizzes & Lobbies</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  onCloseProfileMenu();
                  onOpenShop();
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <ShoppingBag className="h-4.5 w-4.5 text-histo-gold/80" />
                <span>Token Shop</span>
              </button>
              <div className="h-[1px] bg-white/10 my-1" />
              <button
                type="button"
                onClick={() => {
                  logout();
                  onCloseProfileMenu();
                  navigate('/loginpg');
                }}
                className="w-full text-left px-3 py-2.5 text-sm font-ui font-semibold text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5 text-red-400" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

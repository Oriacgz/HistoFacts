import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  UserPlus,
  UserCheck,
  MessageSquare,
  Users,
  Sparkles,
  Trophy,
  CheckCheck,
  Clock,
  Inbox,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUnreadCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications';

const NOTIFICATION_CONFIG = {
  friend_request: {
    icon: UserPlus,
    color: 'text-histo-gold bg-histo-gold/15 border-histo-gold/40',
    target: () => '/friends',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'A scholar'}</strong> sent you a friend request
      </span>
    ),
  },
  friend_request_accepted: {
    icon: UserCheck,
    color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    target: () => '/friends',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'A scholar'}</strong> accepted your friend request
      </span>
    ),
  },
  comment_reply: {
    icon: MessageSquare,
    color: 'text-histo-copper bg-histo-copper/15 border-histo-copper/30',
    target: () => '/feed',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'A scholar'}</strong>{' '}
        {p?.is_mention ? 'mentioned you in a comment' : 'replied to your comment'}
      </span>
    ),
  },
  group_invite: {
    icon: Users,
    color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    target: () => '/groups',
    renderText: (p) => (
      <span>
        You were invited to group <strong className="font-semibold text-histo-paper">{p?.group_name || 'a group'}</strong>
      </span>
    ),
  },
  note_ready: {
    icon: Sparkles,
    color: 'text-histo-gold bg-histo-gold/20 border-histo-gold/40',
    target: () => '/notes',
    renderText: (p) => (
      <span>
        AI Note <strong className="font-semibold text-histo-gold">"{p?.title || 'Historical Analysis'}"</strong> is ready
      </span>
    ),
  },
  quiz_lobby_invite: {
    icon: Trophy,
    color: 'text-histo-gold bg-histo-gold/15 border-histo-gold/30',
    target: (p) => (p?.code ? `/quiz?code=${p.code}` : '/quiz'),
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.host_name || 'Host'}</strong> invited you to Quiz Lobby{' '}
        <span className="font-mono text-histo-gold font-bold tracking-wider">{p?.code || ''}</span>
      </span>
    ),
  },
};

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Poll unread count every 25s
  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Ignored: silent background polling failure
    }
  }, [user]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 25000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // 2. Fetch notifications when dropdown opens or filter changes
  const fetchList = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const beforeId = isLoadMore && notifications.length > 0
        ? notifications[notifications.length - 1].id
        : null;

      const items = await getNotifications({
        unreadOnly,
        limit: 15,
        before: beforeId,
      });

      if (isLoadMore) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setHasMore(items.length === 15);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, unreadOnly, notifications]);

  useEffect(() => {
    if (isOpen) {
      fetchList(false);
    }
  }, [isOpen, unreadOnly]);

  // 3. Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 4. Mark single notification as read
  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationRead(notif.id);
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }

    setIsOpen(false);
    const config = NOTIFICATION_CONFIG[notif.type];
    const targetUrl = config?.target(notif.payload) || '/home';
    navigate(targetUrl);
  };

  // 5. Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('Failed to mark all read:', err);
      fetchCount();
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className={`group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-all duration-300 bg-transparent ${
          isOpen
            ? 'border-histo-gold bg-histo-gold/15'
            : 'border-white/10 hover:border-histo-gold hover:bg-white/5'
        }`}
      >
        <Bell
          className={`h-4.5 w-4.5 transition-colors duration-300 ${
            isOpen || unreadCount > 0 ? 'text-histo-gold' : 'text-histo-paper/85 group-hover:text-histo-gold'
          }`}
        />

        {/* Gold Scholar Unread Badge */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-histo-gold px-1 font-ui text-[10px] font-bold text-histo-dark shadow-sm border border-histo-dark"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}

        {/* Tooltip */}
        {!isOpen && (
          <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 translate-y-[-10px] whitespace-nowrap rounded-[2px] bg-histo-dark border border-histo-gold/30 px-3 py-1.5 text-xs font-ui font-medium text-histo-paper opacity-0 shadow-deep transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-50">
            Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-3 w-80 sm:w-96 rounded-[4px] border border-histo-gold/30 bg-histo-dark text-histo-paper shadow-deep z-50 overflow-hidden text-left"
          >
            {/* Header with Scholar Aesthetic */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-histo-navy/50">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold tracking-wider text-histo-paper uppercase">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-[2px] bg-histo-gold/20 border border-histo-gold/40 px-2 py-0.5 font-mono text-[10px] font-bold text-histo-gold">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-ui font-semibold text-histo-gold hover:text-histo-paper hover:underline cursor-pointer bg-transparent border-none p-0 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-white/10 bg-histo-dark/80 px-4 py-1.5 gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={`rounded-[2px] px-3 py-1 text-xs font-ui uppercase tracking-wider transition-colors cursor-pointer border-none ${
                  !unreadOnly
                    ? 'bg-histo-gold text-histo-dark font-bold shadow-xs'
                    : 'bg-transparent text-histo-paper/60 hover:text-histo-paper'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={`rounded-[2px] px-3 py-1 text-xs font-ui uppercase tracking-wider transition-colors cursor-pointer border-none ${
                  unreadOnly
                    ? 'bg-histo-gold text-histo-dark font-bold shadow-xs'
                    : 'bg-transparent text-histo-paper/60 hover:text-histo-paper'
                }`}
              >
                Unread only
              </button>
            </div>

            {/* Notification List Container */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-histo-gold/30 scrollbar-track-histo-dark">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-histo-paper/60">
                  <Loader2 className="h-6 w-6 animate-spin text-histo-gold mb-2" />
                  <span className="text-xs font-ui">Loading scholar notices...</span>
                </div>
              ) : notifications.length === 0 ? (
                /* Empty State matching HistoFacts theme */
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-histo-medium/40 border border-histo-gold/30 mb-3 text-histo-gold">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <p className="font-display text-base font-bold text-histo-paper">
                    You're all caught up
                  </p>
                  <p className="font-body text-xs text-histo-paper/70 mt-1 max-w-[240px]">
                    {unreadOnly
                      ? 'No unread notifications right now.'
                      : 'When you receive friend requests, comment replies, or AI notes, they will appear here.'}
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const config = NOTIFICATION_CONFIG[notif.type] || {
                    icon: Bell,
                    color: 'text-histo-gold bg-histo-gold/15 border-histo-gold/30',
                    target: () => '/home',
                    renderText: () => <span>New historical update</span>,
                  };
                  const Icon = config.icon;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                        !notif.is_read
                          ? 'bg-histo-gold/[0.08] hover:bg-histo-gold/[0.14] border-l-2 border-l-histo-gold'
                          : 'hover:bg-white/[0.06] opacity-80 hover:opacity-100'
                      }`}
                    >
                      {/* Category / Event Icon */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.color} shadow-xs`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-ui text-histo-paper/95 leading-relaxed">
                          {config.renderText(notif.payload)}
                        </div>

                        {notif.payload?.content_snippet && (
                          <p className="mt-1 font-body text-[11px] text-histo-paper/70 italic line-clamp-1 border-l border-histo-gold/30 pl-2">
                            "{notif.payload.content_snippet}"
                          </p>
                        )}

                        <div className="mt-1 flex items-center gap-1 text-[10px] font-ui text-histo-gold/75">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(notif.created_at)}</span>
                        </div>
                      </div>

                      {/* Unread Indicator Dot */}
                      {!notif.is_read && (
                        <div className="h-2 w-2 rounded-full bg-histo-gold shrink-0 mt-1.5 shadow-sm ring-2 ring-histo-gold/30" />
                      )}
                    </div>
                  );
                })
              )}

              {/* Load More Button */}
              {hasMore && !loading && (
                <div className="p-2 text-center bg-histo-navy/30 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => fetchList(true)}
                    className="text-xs font-ui font-semibold text-histo-gold hover:text-histo-paper hover:underline cursor-pointer bg-transparent border-none py-1 transition-colors"
                  >
                    Load older notices
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

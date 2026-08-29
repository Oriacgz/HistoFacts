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
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    target: () => '/friends',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'A scholar'}</strong> sent you a friend request
      </span>
    ),
  },
  friend_request_accepted: {
    icon: UserCheck,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    target: () => '/friends',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'A scholar'}</strong> accepted your friend request
      </span>
    ),
  },
  comment_reply: {
    icon: MessageSquare,
    color: 'text-histo-gold bg-histo-gold/10 border-histo-gold/20',
    target: () => '/feed',
    renderText: (p) => (
      <span>
        <strong className="font-semibold text-histo-paper">{p?.from_user || 'Someone'}</strong>{' '}
        {p?.is_mention ? 'mentioned you in a comment' : 'replied to your comment'}
      </span>
    ),
  },
  group_invite: {
    icon: Users,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    target: () => '/groups',
    renderText: (p) => (
      <span>
        You were invited to group <strong className="font-semibold text-histo-paper">{p?.group_name || 'a group'}</strong>
      </span>
    ),
  },
  note_ready: {
    icon: Sparkles,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    target: () => '/notes',
    renderText: (p) => (
      <span>
        AI Note <strong className="font-semibold text-histo-paper">"{p?.title || 'Historical Analysis'}"</strong> is ready
      </span>
    ),
  },
  quiz_lobby_invite: {
    icon: Trophy,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
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
      // Ignored: silent failure on background poll
    }
  }, [user]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 25000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // 2. Fetch full list when dropdown opens or filter changes
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

  // 3. Click outside handler
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
      // Optimistically update only this single row
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

    // Optimistically update local state
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
            ? 'border-histo-gold bg-histo-gold/10'
            : 'border-white/10 hover:border-histo-gold/80 hover:bg-white/5'
        }`}
      >
        <Bell
          className={`h-4.5 w-4.5 transition-colors duration-300 ${
            isOpen || unreadCount > 0 ? 'text-histo-gold' : 'text-histo-paper/85 group-hover:text-histo-gold'
          }`}
        />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-histo-gold px-1 font-ui text-[10px] font-bold text-histo-dark shadow-sm"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}

        {/* Hover Tooltip (only when closed) */}
        {!isOpen && (
          <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 translate-y-[-10px] whitespace-nowrap rounded-[2px] bg-histo-dark px-3 py-2 text-xs font-medium text-white opacity-0 shadow-medium transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-50">
            Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-3 w-80 sm:w-96 rounded-lg border border-histo-gold/30 bg-[#121214] shadow-2xl z-50 overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold tracking-wide text-histo-paper">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-histo-gold/20 px-2 py-0.5 font-mono text-[10px] font-bold text-histo-gold">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-ui text-histo-gold/90 hover:text-histo-gold hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-white/5 bg-black/20 px-4 py-1.5 gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={`rounded px-2.5 py-1 text-xs font-ui transition-colors cursor-pointer border-none ${
                  !unreadOnly
                    ? 'bg-white/10 text-histo-gold font-semibold'
                    : 'bg-transparent text-white/60 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={`rounded px-2.5 py-1 text-xs font-ui transition-colors cursor-pointer border-none ${
                  unreadOnly
                    ? 'bg-white/10 text-histo-gold font-semibold'
                    : 'bg-transparent text-white/60 hover:text-white'
                }`}
              >
                Unread only
              </button>
            </div>

            {/* Notification List Container */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-white/50">
                  <Loader2 className="h-6 w-6 animate-spin text-histo-gold mb-2" />
                  <span className="text-xs font-ui">Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 mb-3 text-histo-gold/60">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <p className="font-display text-sm font-semibold text-histo-paper">
                    You're all caught up
                  </p>
                  <p className="font-ui text-xs text-white/50 mt-1 max-w-[220px]">
                    {unreadOnly
                      ? 'No unread notifications right now.'
                      : 'When you get friend requests, replies, or notes, they will appear here.'}
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const config = NOTIFICATION_CONFIG[notif.type] || {
                    icon: Bell,
                    color: 'text-histo-gold bg-histo-gold/10 border-histo-gold/20',
                    target: () => '/home',
                    renderText: () => <span>New notification</span>,
                  };
                  const Icon = config.icon;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`group relative flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                        !notif.is_read
                          ? 'bg-histo-gold/[0.04] hover:bg-histo-gold/[0.08]'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-ui text-white/90 leading-relaxed">
                          {config.renderText(notif.payload)}
                        </div>

                        {notif.payload?.content_snippet && (
                          <p className="mt-1 font-ui text-[11px] text-white/50 italic line-clamp-1 border-l border-white/20 pl-2">
                            "{notif.payload.content_snippet}"
                          </p>
                        )}

                        <div className="mt-1 flex items-center gap-1 text-[10px] font-ui text-white/40">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(notif.created_at)}</span>
                        </div>
                      </div>

                      {/* Unread Dot Indicator */}
                      {!notif.is_read && (
                        <div className="h-2 w-2 rounded-full bg-histo-gold shrink-0 mt-1.5 shadow-sm" />
                      )}
                    </div>
                  );
                })
              )}

              {/* Load More */}
              {hasMore && !loading && (
                <div className="p-2 text-center bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() => fetchList(true)}
                    className="text-xs font-ui text-histo-gold hover:underline cursor-pointer bg-transparent border-none py-1"
                  >
                    Load older notifications
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

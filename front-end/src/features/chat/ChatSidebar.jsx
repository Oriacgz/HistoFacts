import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { getMessagesApi, getNewMessagesApi, sendMessageApi } from '../../api/chat';
import ConversationListItem from './ConversationListItem';
import ChatThread from './ChatThread';
import ChatComposer from './ChatComposer';

export default function ChatSidebar() {
  const { user } = useAuth();
  const {
    isChatOpen,
    closeChat,
    conversations,
    activeConversation,
    selectConversation,
    goBackToList,
  } = useChat();

  const [tab, setTab] = useState('direct');
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const filteredConversations = conversations.filter((c) =>
    tab === 'direct' ? c.type === 'direct' : c.type === 'group'
  );

  // Load initial messages when a conversation is selected
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const msgs = await getMessagesApi(activeConversation.id);
        if (!cancelled) {
          setMessages(msgs || []);
          setHasMore((msgs || []).length >= 30);
        }
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();

    return () => { cancelled = true; };
  }, [activeConversation]);

  // Poll for new messages every 4s when inside a conversation
  useEffect(() => {
    if (!activeConversation || !isChatOpen) return;

    pollRef.current = setInterval(async () => {
      const lastMsg = messages[messages.length - 1];
      try {
        const newMsgs = await getNewMessagesApi(
          activeConversation.id,
          lastMsg?.id || null
        );
        if (newMsgs?.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = newMsgs.filter((m) => !existingIds.has(m.id));
            return unique.length > 0 ? [...prev, ...unique] : prev;
          });
        }
      } catch { /* silent */ }
    }, 4000);

    return () => clearInterval(pollRef.current);
  }, [activeConversation, isChatOpen, messages]);

  // Load older messages on scroll-up
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !activeConversation || !messages.length) return;
    loadingMoreRef.current = true;

    try {
      const oldestMsg = messages[0];
      const older = await getMessagesApi(activeConversation.id, oldestMsg.id, 30);
      if (older?.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = older.filter((m) => !existingIds.has(m.id));
          return [...unique, ...prev];
        });
        setHasMore(older.length >= 30);
      } else {
        setHasMore(false);
      }
    } catch { /* ignore */ }

    loadingMoreRef.current = false;
  }, [activeConversation, messages]);

  const handleSend = useCallback(async (payload) => {
    if (!activeConversation || sending) return;
    setSending(true);
    try {
      const msg = await sendMessageApi(activeConversation.id, payload);
      if (msg) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  }, [activeConversation, sending]);

  const isGroup = activeConversation?.type === 'group';

  // Get header info for the active conversation
  const getHeaderTitle = () => {
    if (!activeConversation) return '';
    if (activeConversation.type === 'direct') {
      const other = activeConversation.participants?.find((p) => p.id !== user?.id)
        || activeConversation.participants?.[0];
      return other ? `${other.username}#${other.tag}` : 'Direct Message';
    }
    return activeConversation.group_name || 'Group Chat';
  };

  const getHeaderSubtitle = () => {
    if (!activeConversation) return '';
    if (activeConversation.type === 'group') {
      return 'Group conversation';
    }
    return 'Direct message';
  };

  return (
    <AnimatePresence>
      {isChatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeChat}
            className="fixed inset-0 bg-black/20 z-50"
          />

          {/* Sidebar Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-histo-paper border-l border-histo-dark/10 shadow-deep z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-histo-dark/10 bg-white shrink-0">
              {activeConversation ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={goBackToList}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-histo-cream/60 transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <ArrowLeft className="h-4 w-4 text-histo-ink/70" />
                  </button>
                  <div>
                    <h3 className="text-sm font-ui font-bold text-histo-dark m-0 leading-tight">
                      {getHeaderTitle()}
                    </h3>
                    <p className="text-[10px] font-ui text-histo-ink/50 m-0 tracking-wide">
                      {getHeaderSubtitle()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-histo-copper" />
                  <h3 className="text-sm font-display font-bold text-histo-dark m-0">
                    Messages
                  </h3>
                </div>
              )}
              <button
                type="button"
                onClick={closeChat}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 transition-colors cursor-pointer bg-transparent border-none group"
              >
                <X className="h-4 w-4 text-histo-ink/50 group-hover:text-red-500 transition-colors" />
              </button>
            </div>

            {/* Conversation List View */}
            {!activeConversation && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Tabs */}
                <div className="flex border-b border-histo-dark/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTab('direct')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-ui font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer bg-transparent ${
                      tab === 'direct'
                        ? 'border-histo-copper text-histo-copper'
                        : 'border-transparent text-histo-ink/50 hover:text-histo-dark'
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('group')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-ui font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer bg-transparent ${
                      tab === 'group'
                        ? 'border-histo-copper text-histo-copper'
                        : 'border-transparent text-histo-ink/50 hover:text-histo-dark'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Groups
                  </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  {filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                      {tab === 'direct' ? (
                        <>
                          <MessageCircle className="h-10 w-10 text-histo-copper/30 mb-3" />
                          <p className="text-sm font-display font-bold text-histo-dark/60 mb-1">No messages yet</p>
                          <p className="text-[11px] font-body text-histo-ink/40 leading-relaxed">
                            Start a chat from your friends list to begin a conversation.
                          </p>
                        </>
                      ) : (
                        <>
                          <Users className="h-10 w-10 text-histo-copper/30 mb-3" />
                          <p className="text-sm font-display font-bold text-histo-dark/60 mb-1">No group chats</p>
                          <p className="text-[11px] font-body text-histo-ink/40 leading-relaxed">
                            Open a group chat from the Groups page to start messaging.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <ConversationListItem
                        key={conv.id}
                        conversation={conv}
                        currentUserId={user?.id}
                        onClick={() => selectConversation(conv)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Chat Thread View */}
            {activeConversation && (
              <div className="flex-1 flex flex-col min-h-0">
                <ChatThread
                  messages={messages}
                  onLoadMore={loadMore}
                  hasMore={hasMore}
                  isGroup={isGroup}
                  currentUserId={user?.id}
                />
                <ChatComposer onSend={handleSend} disabled={sending} />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

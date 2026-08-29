import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, MessageCircle, Users, UserPlus, Plus, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { getMessagesApi, getNewMessagesApi, sendMessageApi } from '../../api/chat';
import { getFriendsApi } from '../../api/friends';
import ConversationListItem from './ConversationListItem';
import ChatThread from './ChatThread';
import ChatComposer from './ChatComposer';

export default function ChatSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    isChatOpen,
    closeChat,
    conversations,
    activeConversation,
    selectConversation,
    goBackToList,
    openDirectChat,
  } = useChat();

  const [tab, setTab] = useState('direct');
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showFriendsPicker, setShowFriendsPicker] = useState(false);
  const pollRef = useRef(null);
  const loadingMoreRef = useRef(false);

  // Fetch friends list whenever chat opens
  useEffect(() => {
    if (!isChatOpen || !user) return;
    let cancelled = false;
    (async () => {
      setLoadingFriends(true);
      try {
        const data = await getFriendsApi();
        if (!cancelled) setFriends(data || []);
      } catch (err) {
        console.error('Failed to load friends for chat:', err);
      } finally {
        if (!cancelled) setLoadingFriends(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isChatOpen, user]);

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

  const handleStartChatWithFriend = async (friendId) => {
    setShowFriendsPicker(false);
    await openDirectChat(friendId);
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
                    onClick={() => {
                      setTab('direct');
                      setShowFriendsPicker(false);
                    }}
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
                    onClick={() => {
                      setTab('group');
                      setShowFriendsPicker(false);
                    }}
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

                {/* Sub-header actions for Direct messages */}
                {tab === 'direct' && friends.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-histo-dark/5 bg-histo-cream/20">
                    <span className="text-[11px] font-ui font-semibold text-histo-ink/60 uppercase tracking-wider">
                      {showFriendsPicker ? 'Select Friend to Chat' : 'Conversations'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFriendsPicker(!showFriendsPicker)}
                      className="inline-flex items-center gap-1 text-[11px] font-ui font-bold text-histo-copper hover:text-histo-dark transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      {showFriendsPicker ? (
                        <span>← Back to Chats</span>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>New Chat</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* List Container */}
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  {/* View 1: Friends Picker when user clicks "+ New Chat" */}
                  {tab === 'direct' && showFriendsPicker ? (
                    <div className="flex flex-col gap-1">
                      <div className="px-2 py-1 mb-1">
                        <p className="text-xs font-body text-histo-ink/70 m-0">
                          Pick a friend to message:
                        </p>
                      </div>
                      {friends.map((friend) => (
                        <motion.button
                          key={friend.id}
                          type="button"
                          onClick={() => handleStartChatWithFriend(friend.id)}
                          whileHover={{ x: 2 }}
                          className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-white border border-transparent hover:border-histo-dark/10 transition-all cursor-pointer bg-transparent"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-sm shrink-0 shadow-sm">
                              {friend.username ? friend.username[0].toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-ui font-bold text-histo-dark block truncate">
                                {friend.username}#{friend.tag}
                              </span>
                              <span className={`text-[10px] font-ui font-medium ${
                                friend.is_online ? 'text-emerald-600' : 'text-histo-ink/40'
                              }`}>
                                ● {friend.is_online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-ui font-semibold text-histo-copper uppercase tracking-wider shrink-0 bg-histo-copper/10 px-2 py-1 rounded-[2px]">
                            Chat →
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    /* View 2: Empty States */
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
                      {tab === 'direct' ? (
                        friends.length > 0 ? (
                          /* User HAS friends, but hasn't sent a message yet */
                          <div className="w-full">
                            <div className="h-12 w-12 rounded-full bg-histo-gold/15 border border-histo-gold/30 flex items-center justify-center mx-auto mb-3 text-histo-gold">
                              <MessageSquarePlus className="h-6 w-6 text-histo-dark" />
                            </div>
                            <p className="text-sm font-display font-bold text-histo-dark mb-1">
                              Start a Conversation
                            </p>
                            <p className="text-[11px] font-body text-histo-ink/65 leading-relaxed mb-4 max-w-[260px] mx-auto">
                              You have {friends.length} scholar friend{friends.length > 1 ? 's' : ''} connected! Select a scholar below to start chatting:
                            </p>

                            {/* Friends List Quick Pick */}
                            <div className="flex flex-col gap-1.5 text-left max-h-[220px] overflow-y-auto mb-4 bg-white/70 p-1.5 rounded-[4px] border border-histo-dark/10 shadow-soft">
                              {friends.map((friend) => (
                                <button
                                  key={friend.id}
                                  type="button"
                                  onClick={() => handleStartChatWithFriend(friend.id)}
                                  className="w-full flex items-center justify-between gap-2 p-2 rounded-[3px] hover:bg-histo-cream/40 transition-colors cursor-pointer bg-transparent border-none"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-xs shrink-0">
                                      {friend.username ? friend.username[0].toUpperCase() : 'U'}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <span className="text-xs font-ui font-semibold text-histo-dark block truncate">
                                        {friend.username}#{friend.tag}
                                      </span>
                                      <span className={`text-[9px] font-ui ${
                                        friend.is_online ? 'text-emerald-600 font-semibold' : 'text-histo-ink/40'
                                      }`}>
                                        ● {friend.is_online ? 'Online' : 'Offline'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-ui font-bold text-white bg-histo-copper hover:bg-histo-dark px-2.5 py-1 rounded-[2px] uppercase transition-colors shrink-0">
                                    Message
                                  </span>
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                closeChat();
                                navigate('/friends');
                              }}
                              className="text-[11px] font-ui text-histo-copper hover:underline cursor-pointer bg-transparent border-none"
                            >
                              + Find more scholar friends
                            </button>
                          </div>
                        ) : (
                          /* User has NO friends */
                          <>
                            <div className="h-14 w-14 rounded-full bg-histo-copper/10 border border-histo-copper/20 flex items-center justify-center mb-3 text-histo-copper">
                              <MessageCircle className="h-7 w-7" />
                            </div>
                            <p className="text-sm font-display font-bold text-histo-dark mb-1">No Friends Added Yet</p>
                            <p className="text-[11px] font-body text-histo-ink/60 leading-relaxed mb-4 max-w-[240px]">
                              Connect with fellow historians by username or tag to start private direct messaging!
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                closeChat();
                                navigate('/friends');
                              }}
                              className="inline-flex items-center gap-2 bg-histo-copper text-white px-4 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer shadow-soft"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>Add Friends</span>
                            </button>
                          </>
                        )
                      ) : (
                        /* Groups Empty State */
                        <>
                          <div className="h-14 w-14 rounded-full bg-histo-copper/10 border border-histo-copper/20 flex items-center justify-center mb-3 text-histo-copper">
                            <Users className="h-7 w-7" />
                          </div>
                          <p className="text-sm font-display font-bold text-histo-dark mb-1">No Study Groups Yet</p>
                          <p className="text-[11px] font-body text-histo-ink/60 leading-relaxed mb-4 max-w-[240px]">
                            Join an existing study guild or create one with at least 3 scholars (up to 50 members).
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              closeChat();
                              navigate('/groups');
                            }}
                            className="inline-flex items-center gap-2 bg-histo-copper text-white px-4 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer shadow-soft"
                          >
                            <Users className="h-4 w-4" />
                            <span>Explore & Create Groups</span>
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    /* View 3: Active Conversations List */
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

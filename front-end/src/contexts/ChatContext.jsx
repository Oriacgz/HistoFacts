import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getConversationsApi, getOrCreateDirectApi, getOrCreateGroupChatApi, markAsReadApi } from '../api/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getConversationsApi();
      setConversations(data || []);
      const total = (data || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setTotalUnreadCount(total);
    } catch {
      /* silent fail for polling */
    }
  }, [user]);

  // Poll conversations every 5s when sidebar is open on list view
  useEffect(() => {
    if (!user) return;
    // Initial fetch
    fetchConversations();

    if (isChatOpen && !activeConversation) {
      pollRef.current = setInterval(fetchConversations, 5000);
      return () => clearInterval(pollRef.current);
    }
  }, [user, isChatOpen, activeConversation, fetchConversations]);

  // Also poll when sidebar is closed, but slower (for badge updates)
  useEffect(() => {
    if (!user || isChatOpen) return;
    const badgePoll = setInterval(fetchConversations, 15000);
    return () => clearInterval(badgePoll);
  }, [user, isChatOpen, fetchConversations]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    fetchConversations();
  }, [fetchConversations]);
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActiveConversation(null);
  }, []);

  const openDirectChat = useCallback(async (friendUserId) => {
    try {
      const conv = await getOrCreateDirectApi(friendUserId);
      setActiveConversation(conv);
      setIsChatOpen(true);
      await markAsReadApi(conv.id);
      fetchConversations();
    } catch (err) {
      console.error('Failed to open direct chat:', err);
    }
  }, [fetchConversations]);

  const openGroupChat = useCallback(async (groupId) => {
    try {
      const conv = await getOrCreateGroupChatApi(groupId);
      setActiveConversation(conv);
      setIsChatOpen(true);
      await markAsReadApi(conv.id);
      fetchConversations();
    } catch (err) {
      console.error('Failed to open group chat:', err);
    }
  }, [fetchConversations]);

  const selectConversation = useCallback(async (conv) => {
    setActiveConversation(conv);
    try {
      await markAsReadApi(conv.id);
      fetchConversations();
    } catch { /* ignore */ }
  }, [fetchConversations]);

  const goBackToList = useCallback(() => {
    setActiveConversation(null);
    fetchConversations();
  }, [fetchConversations]);

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        openChat,
        closeChat,
        conversations,
        activeConversation,
        selectConversation,
        goBackToList,
        openDirectChat,
        openGroupChat,
        totalUnreadCount,
        fetchConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

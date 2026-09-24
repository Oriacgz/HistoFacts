import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations } from '../hooks/queries/useConversations';
import { getOrCreateDirectApi, getOrCreateGroupChatApi, markAsReadApi } from '../api/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const queryClient = useQueryClient();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState(null);

  // React Query handles polling with adaptive rate (5s open / 15s background)
  const {
    data: conversations = [],
    refetch: refetchConversations,
  } = useConversations({
    isOpen: isChatOpen,
    hasActiveConversation: !!activeConversation,
  });

  const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  /** Manually trigger a conversations refresh (e.g. after sending a message). */
  const fetchConversations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  }, [queryClient]);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    refetchConversations();
  }, [refetchConversations]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setActiveConversation(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        refetchConversations();
      } else {
        setActiveConversation(null);
      }
      return next;
    });
  }, [refetchConversations]);

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

  const value = useMemo(
    () => ({
      isChatOpen,
      isOpen: isChatOpen,
      toggleSidebar,
      toggleChat: toggleSidebar,
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
    }),
    [
      isChatOpen,
      toggleSidebar,
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
    ]
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  return context;
}

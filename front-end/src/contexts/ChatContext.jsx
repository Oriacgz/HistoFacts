import { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useConversations } from '../hooks/queries/useConversations';
import { getOrCreateDirectApi, getOrCreateGroupChatApi, markAsReadApi } from '../api/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
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

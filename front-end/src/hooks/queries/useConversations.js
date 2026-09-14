import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getConversationsApi } from '../../api/chat';

/**
 * Polls the conversations list.
 * - Every 5 seconds when the chat sidebar is open on the list view.
 * - Every 15 seconds in background (for badge count updates).
 *
 * @param {{ isOpen: boolean, hasActiveConversation: boolean }} options
 */
export function useConversations({ isOpen = false, hasActiveConversation = false } = {}) {
  const { user } = useAuth();

  // Determine poll interval:
  // 5s when sidebar is open & on conversation list, 15s otherwise (badge badge)
  const refetchInterval = isOpen && !hasActiveConversation ? 5_000 : 15_000;

  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: async () => {
      const data = await getConversationsApi();
      return data || [];
    },
    enabled: !!user,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 4_000,
    initialData: [],
  });
}

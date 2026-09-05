import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUnreadCount } from '../../api/notifications';

/**
 * Polls the unread notification count every 25 seconds.
 * Replaces the manual setInterval in NotificationDropdown.
 */
export function useUnreadNotificationsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const data = await getUnreadCount();
      return data.unread_count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 25_000,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
    initialData: 0,
  });
}

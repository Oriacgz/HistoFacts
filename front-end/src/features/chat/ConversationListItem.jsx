import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

export default function ConversationListItem({ conversation, currentUserId, onClick }) {
  const isDirect = conversation.type === 'direct';
  const unread = conversation.unread_count || 0;

  // For direct chats, show the other participant's info
  const otherUser = isDirect
    ? conversation.participants?.find((p) => p.id !== currentUserId) || conversation.participants?.[0]
    : null;

  const displayName = isDirect
    ? otherUser
      ? `${otherUser.username}#${otherUser.tag}`
      : 'Unknown User'
    : conversation.group_name || 'Group Chat';

  const avatarLetter = isDirect
    ? otherUser?.username?.[0]?.toUpperCase() || '?'
    : conversation.group_name?.[0]?.toUpperCase() || 'G';

  const lastMsg = conversation.last_message;
  const lastPreview = lastMsg
    ? lastMsg.message_type === 'text'
      ? lastMsg.content
      : lastMsg.message_type === 'note_share'
        ? '📝 Shared a note'
        : '🎮 Shared a quiz lobby'
    : 'No messages yet';

  const lastTime = lastMsg
    ? formatRelativeTime(new Date(lastMsg.created_at))
    : '';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 2 }}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer bg-transparent border-none group ${
        unread > 0
          ? 'bg-histo-gold/5 hover:bg-histo-gold/10'
          : 'hover:bg-histo-cream/50'
      }`}
    >
      {/* Avatar */}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-base shadow-sm ${
        isDirect
          ? 'bg-histo-dark text-histo-gold'
          : 'bg-histo-copper/20 text-histo-copper border border-histo-copper/30'
      }`}>
        {isDirect ? avatarLetter : <Users className="h-4.5 w-4.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-ui truncate ${
            unread > 0 ? 'font-bold text-histo-dark' : 'font-medium text-histo-ink/85'
          }`}>
            {displayName}
          </span>
          <span className="text-[10px] font-ui text-histo-ink/40 shrink-0 tracking-wide">
            {lastTime}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[11px] truncate m-0 ${
            unread > 0 ? 'font-ui font-semibold text-histo-ink/70' : 'font-body text-histo-ink/50'
          }`}>
            {lastMsg && lastMsg.sender_id !== currentUserId && conversation.type === 'group'
              ? `${lastMsg.sender_username}: ${lastPreview}`
              : lastPreview}
          </p>
          {unread > 0 && (
            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-histo-gold text-histo-dark text-[10px] font-ui font-bold shrink-0">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

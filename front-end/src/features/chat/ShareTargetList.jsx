import { Search, Users, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Reusable multi-select target list component for sharing.
 * Renders conversation items (direct / group) with search filtering and multi-selection checkboxes.
 *
 * @param {Array} targets - Array of conversation objects { id, type, group_name, participants, last_message, ... }
 * @param {Set<string>} selected - Set of selected conversation IDs
 * @param {Function} onToggle - Callback (id) => void when an item is selected/deselected
 * @param {string} searchQuery - Search query string
 * @param {Function} onSearchChange - Callback (string) => void
 */
export default function ShareTargetList({
  targets = [],
  selected = new Set(),
  onToggle,
  searchQuery = '',
  onSearchChange,
}) {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const filteredTargets = targets.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (conv.type === 'direct') {
      const otherUser = conv.participants?.find((p) => p.id !== currentUserId) || conv.participants?.[0];
      const name = otherUser?.username || '';
      return name.toLowerCase().includes(q);
    }
    return (conv.group_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-histo-ink/40 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations or groups..."
          className="w-full pl-9 pr-3 py-2 text-xs font-ui bg-histo-cream/40 border border-histo-dark/15 rounded-md text-histo-dark placeholder:text-histo-ink/40 focus:outline-none focus:border-histo-copper focus:bg-white transition-colors"
        />
      </div>

      {/* Target Items List */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-[220px] max-h-[340px] pr-1">
        {filteredTargets.length === 0 ? (
          <div className="py-8 text-center text-xs font-ui text-histo-ink/50">
            {searchQuery ? 'No conversations match your search.' : 'No conversations available.'}
          </div>
        ) : (
          filteredTargets.map((conv) => {
            const isDirect = conv.type === 'direct';
            const isSelected = selected.has(conv.id);

            const otherUser = isDirect
              ? conv.participants?.find((p) => p.id !== currentUserId) || conv.participants?.[0]
              : null;

            const displayName = isDirect
              ? (otherUser?.username
                  ? `${otherUser.username}${otherUser.tag ? '#' + otherUser.tag : ''}`
                  : 'Scholar')
              : conv.group_name || 'Group Chat';

            const avatarLetter = isDirect
              ? otherUser?.username?.[0]?.toUpperCase() || 'S'
              : conv.group_name?.[0]?.toUpperCase() || 'G';

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onToggle(conv.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-histo-copper/10 border-histo-copper/40 shadow-2xs'
                    : 'bg-white/60 border-transparent hover:bg-histo-cream/60 hover:border-histo-dark/10'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-sm shadow-2xs ${
                    isDirect
                      ? 'bg-histo-dark text-histo-gold'
                      : 'bg-histo-copper/20 text-histo-copper border border-histo-copper/30'
                  }`}
                >
                  {isDirect ? avatarLetter : <Users className="h-4 w-4" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-ui font-semibold text-histo-dark truncate">
                      {displayName}
                    </span>
                    <span className="text-[10px] font-ui text-histo-ink/40 shrink-0 capitalize">
                      {conv.type}
                    </span>
                  </div>
                  <p className="text-[11px] font-ui text-histo-ink/50 truncate m-0">
                    {isDirect
                      ? 'Direct message'
                      : `${conv.participants?.length || 'Multiple'} members`}
                  </p>
                </div>

                {/* Checkbox indicator */}
                <div
                  className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-histo-copper border-histo-copper text-white'
                      : 'border-histo-dark/20 bg-white'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

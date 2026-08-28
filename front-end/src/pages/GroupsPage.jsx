import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Users, UserPlus, Info, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { useToast } from '../contexts/ToastContext';
import { getMyGroupsApi, createGroupApi } from '../api/groups';
import { getFriendsApi } from '../api/friends';

export default function GroupsPage() {
  const { user } = useAuth();
  const { openGroupChat } = useChat();
  const toast = useToast();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, friendsData] = await Promise.all([
        getMyGroupsApi(),
        getFriendsApi().catch(() => []),
      ]);
      setGroups(groupsData || []);
      setFriends(friendsData || []);
    } catch (err) {
      console.error('Failed to load groups data:', err);
      setError('Unable to load study groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleFriendSelection = (friendId) => {
    setSelectedFriendIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      }
      // Check maximum limit (50 members total = 1 creator + 49 invited)
      if (prev.length >= 49) {
        toast.warning('Maximum 50 members allowed per group (1 creator + 49 friends).');
        return prev;
      }
      return [...prev, friendId];
    });
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Minimum requirement: creator + at least 2 friends = 3 members
    if (selectedFriendIds.length < 2) {
      toast.error('Minimum 3 people required to create a group! Please select at least 2 friends.');
      return;
    }

    setCreating(true);
    try {
      const newGroup = await createGroupApi(name.trim(), description.trim(), selectedFriendIds);
      setGroups([newGroup, ...groups]);
      setName('');
      setDescription('');
      setSelectedFriendIds([]);
      toast.success(`Study guild "${newGroup.name}" created successfully with ${newGroup.member_count} members!`);
    } catch (err) {
      console.error('Failed to create group:', err);
      toast.error(err?.data?.detail || err.message || 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const totalMemberCount = 1 + selectedFriendIds.length;
  const isMinMembersMet = selectedFriendIds.length >= 2;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Group List */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-histo-dark">Study Groups & Guilds</h1>
          <p className="font-body text-sm text-histo-ink/70 mt-1">
            Collaborate in private guilds (minimum 3 scholars, maximum 50) for historical research and group chat.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-body italic text-histo-ink/60">
            Loading your study groups...
          </div>
        ) : groups.length === 0 ? (
          /* Empty State when user has no groups */
          <div className="bg-white border border-histo-dark/10 p-10 text-center rounded-[4px] shadow-soft">
            <div className="h-16 w-16 rounded-full bg-histo-copper/10 border border-histo-copper/20 flex items-center justify-center mx-auto mb-4 text-histo-copper">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="font-display text-xl font-bold text-histo-dark mb-1">No Study Guilds Joined Yet</h3>
            <p className="font-body text-xs text-histo-ink/70 leading-relaxed max-w-md mx-auto mb-6">
              Create your own guild with at least 2 friends using the form on the right, or add fellow scholars to start collaborating!
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/friends"
                className="inline-flex items-center gap-2 bg-histo-copper text-white px-5 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer shadow-soft"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Friends</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((group) => {
              const isFull = (group.member_count || 1) >= 50;
              return (
                <motion.div
                  key={group.id}
                  whileHover={{ y: -2 }}
                  className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-xl font-bold text-histo-dark">{group.name}</h3>
                      <span
                        className={`text-[10px] font-ui font-semibold px-2.5 py-0.5 rounded-[2px] ${
                          isFull
                            ? 'text-red-700 bg-red-50 border border-red-200'
                            : 'text-histo-copper bg-histo-copper/10'
                        }`}
                      >
                        {group.member_count || 1}/50 Members {isFull && '(Full)'}
                      </span>
                    </div>
                    <p className="font-body text-xs text-histo-ink/80 leading-relaxed mb-4">
                      {group.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-histo-dark/10">
                    <button
                      type="button"
                      onClick={() => openGroupChat(group.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-ui font-bold text-histo-copper hover:text-histo-dark transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Group Chat</span>
                    </button>
                    <Link
                      to={`/feed?group=${group.id}`}
                      className="text-xs font-ui font-bold text-histo-dark uppercase hover:text-histo-gold transition-colors cursor-pointer"
                    >
                      Enter Discussion →
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Create Group */}
      <div className="lg:col-span-5">
        <div className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft sticky top-24">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-xl font-bold text-histo-dark">Create New Guild</h2>
            <span className="text-[11px] font-ui font-semibold text-histo-ink/50">
              {totalMemberCount}/50 Members
            </span>
          </div>
          <p className="font-body text-[11px] text-histo-ink/60 mb-4 leading-relaxed">
            Must include at least 3 scholars (you + at least 2 friends). Max capacity: 50.
          </p>

          <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">
                Guild Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ancient Rome Researchers"
                required
                className="w-full px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui outline-none focus:border-histo-copper"
              />
            </div>

            <div>
              <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Focus area, curriculum, or research topic..."
                className="w-full h-16 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-body outline-none focus:border-histo-copper resize-none"
              />
            </div>

            {/* Friend Selection (Minimum 2 required) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 flex items-center gap-1.5">
                  <span>Invite Friends</span>
                  <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[10px] font-ui font-semibold px-2 py-0.5 rounded-[2px] ${
                    isMinMembersMet
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-amber-700 bg-amber-50'
                  }`}
                >
                  {selectedFriendIds.length}/2 min selected
                </span>
              </div>

              {friends.length === 0 ? (
                <div className="bg-histo-cream/40 border border-histo-dark/10 p-3.5 rounded-[2px] text-center">
                  <Info className="h-4 w-4 text-histo-copper mx-auto mb-1.5" />
                  <p className="text-[11px] font-body text-histo-ink/70 mb-2">
                    You need at least 2 friends connected to start a guild (minimum 3 members total).
                  </p>
                  <Link
                    to="/friends"
                    className="inline-flex items-center gap-1.5 text-xs font-ui font-bold uppercase tracking-wider text-histo-copper hover:text-histo-dark transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add Friends First →</span>
                  </Link>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-histo-dark/15 rounded-[2px] p-2 flex flex-col gap-1.5 bg-histo-cream/20">
                  {friends.map((friend) => {
                    const isSelected = selectedFriendIds.includes(friend.id);
                    return (
                      <button
                        type="button"
                        key={friend.id}
                        onClick={() => toggleFriendSelection(friend.id)}
                        className={`flex items-center justify-between p-2 rounded-[2px] text-left transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-histo-gold/15 border-histo-gold text-histo-dark'
                            : 'bg-white border-histo-dark/10 text-histo-ink/80 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-[10px] shrink-0">
                            {friend.username?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="text-xs font-ui font-medium truncate">
                            {friend.username}#{friend.tag}
                          </span>
                        </div>
                        <div
                          className={`h-4 w-4 rounded-[2px] flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-histo-copper border-histo-copper text-white'
                              : 'border-histo-dark/30 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Validation Notice Banner */}
            {!isMinMembersMet && friends.length >= 2 && (
              <div className="flex items-center gap-2 p-2.5 rounded-[2px] bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-ui">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Select at least {2 - selectedFriendIds.length} more friend(s) to meet the 3-member minimum.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!user || !name.trim() || !isMinMembersMet || creating}
              className="w-full mt-2 bg-histo-dark text-histo-paper py-3 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-gold hover:text-histo-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-soft flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span>{creating ? 'Creating Guild...' : `Create Guild (${totalMemberCount} Members)`}</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}


import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { getFriendsApi, addFriendApi, removeFriendApi, searchUsersByTagApi } from '../api/friends';
import { Users, Search, User, MessageSquare } from 'lucide-react';

export default function FriendsPage() {
  const { user } = useAuth();
  const { openDirectChat } = useChat();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('my-friends');
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [searchTag, setSearchTag] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriends();
    } else {
      setFriendsList([]);
      setLoadingFriends(false);
    }
  }, [user]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const data = await getFriendsApi();
      setFriendsList(data || []);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTag.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsersByTagApi(searchTag.trim());
      setSearchResults(results || []);
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (friendUser) => {
    if (friendsList.some(f => f.username === friendUser.username && f.tag === friendUser.tag)) {
      toast.info(`Already friends with ${friendUser.username}#${friendUser.tag}!`);
      return;
    }
    try {
      const added = await addFriendApi({ friend_id: friendUser.id });
      setFriendsList(prev => [...prev, added]);
      toast.success(`Added ${friendUser.username}#${friendUser.tag} as friend!`);
    } catch (err) {
      console.error('Failed to add friend:', err);
      toast.error('Failed to add friend. Please try again.');
    }
  };

  const handleRemoveFriend = async (friendId, friendName) => {
    try {
      await removeFriendApi(friendId);
      setFriendsList(prev => prev.filter(f => f.id !== friendId));
      toast.info(`Removed ${friendName} from friends.`);
    } catch (err) {
      console.error('Failed to remove friend:', err);
      toast.error('Failed to remove friend. Please try again.');
    }
  };

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-histo-dark mb-1">Scholar Connections</h1>
            <p className="font-body text-sm text-histo-ink/70">Connect with fellow historians, share notes, and collaborate on research.</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-histo-dark/15 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('my-friends')}
            className={`px-6 py-3 text-xs font-ui font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === 'my-friends'
                ? 'border-histo-copper text-histo-copper'
                : 'border-transparent text-histo-ink/60 hover:text-histo-dark'
            }`}
          >
            My Friends ({friendsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('add-friends')}
            className={`px-6 py-3 text-xs font-ui font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === 'add-friends'
                ? 'border-histo-copper text-histo-copper'
                : 'border-transparent text-histo-ink/60 hover:text-histo-dark'
            }`}
          >
            + Add Friends
          </button>
        </div>

        {/* TAB 1: My Friends */}
        {activeTab === 'my-friends' && (
          <div className="flex flex-col gap-4">
            {friendsList.length === 0 ? (
              <div className="bg-white border border-histo-dark/10 p-12 text-center rounded-[4px]">
                <Users className="h-10 w-10 text-histo-copper mx-auto mb-3 opacity-60" />
                <p className="font-display text-lg font-bold text-histo-dark mb-1">No friends added yet</p>
                <p className="font-body text-xs text-histo-ink/60 mb-4">Search by tag to add your fellow scholars.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('add-friends')}
                  className="bg-histo-copper text-white px-5 py-2 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer"
                >
                  Find Friends
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friendsList.map((friend) => (
                  <motion.div
                    key={friend.id}
                    whileHover={{ y: -2 }}
                    className="bg-white border border-histo-dark/10 p-5 rounded-[4px] shadow-soft flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-base shadow-soft">
                            {friend.username[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-ui text-sm font-bold text-histo-dark block">
                              {friend.username}#{friend.tag}
                            </span>
                            <span className="text-[10px] font-ui font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[2px]">
                              ● {friend.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="font-body text-xs text-histo-ink/75 leading-relaxed mb-4">
                        {friend.bio}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-histo-dark/10">
                      <button
                        type="button"
                        onClick={() => openDirectChat(friend.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-ui font-semibold text-histo-copper hover:text-histo-dark transition-colors cursor-pointer bg-transparent border-none p-0"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Message →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(friend.id, `${friend.username}#${friend.tag}`)}
                        className="text-[11px] font-ui text-red-500 hover:underline cursor-pointer bg-transparent border-none"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Add Friends */}
        {activeTab === 'add-friends' && (
          <div>
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-8">
              <input
                type="text"
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                placeholder="Enter exact tag (e.g. Ryan#3081 or username)..."
                className="flex-1 px-4 py-3 bg-white border border-histo-dark/15 rounded-[2px] text-sm font-ui outline-none focus:border-histo-copper shadow-soft"
              />
              <button
                type="submit"
                className="bg-histo-copper text-white px-6 py-3 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors cursor-pointer shadow-soft flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </form>

            {/* Results */}
            {searching ? (
              <div className="py-12 text-center text-sm font-body italic text-histo-ink/60">Searching archives for scholar tag...</div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-ui font-semibold uppercase tracking-wider text-histo-ink/50 mb-1">Search Results</h3>
                {searchResults.map((u) => (
                  <div key={u.id} className="bg-white border border-histo-dark/10 p-5 rounded-[4px] shadow-soft flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-base">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="font-ui text-sm font-bold text-histo-dark block">{u.username}#{u.tag}</span>
                        <span className="text-[11px] font-ui text-histo-ink/50">{u.bio || 'Registered Scholar'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddFriend(u)}
                      className="bg-histo-copper text-white px-4 py-2 rounded-[2px] text-xs font-ui font-semibold uppercase hover:bg-histo-dark transition-colors cursor-pointer shadow-soft"
                    >
                      + Add Friend
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-histo-dark/10 p-8 text-center rounded-[4px]">
                <User className="h-8 w-8 text-histo-ink/30 mx-auto mb-2" />
                <p className="font-body text-xs text-histo-ink/60">Enter a scholar's username or tag above (e.g. <code className="bg-histo-cream px-1 py-0.5 rounded font-mono text-xs">Ryan#3081</code>) to send a friend request.</p>
              </div>
            )}
          </div>
        )}
    </main>
  );
}

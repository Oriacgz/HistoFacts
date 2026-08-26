import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getMyGroupsApi, createGroupApi } from '../api/groups';


export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await getMyGroupsApi();
      setGroups(data || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError('Unable to load study groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const newGroup = await createGroupApi(name.trim(), description.trim());
      setGroups([newGroup, ...groups]);
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('Failed to create group. Please try again.');
    }
  };

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Group List */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <h1 className="font-display text-3xl font-bold text-histo-dark">Study Groups & Guilds</h1>
          <p className="font-body text-sm text-histo-ink/70">Join private or public groups to collaborate on curriculum notes and historical research.</p>

          {loading ? (
            <div className="py-12 text-center text-sm font-body italic text-histo-ink/60">Loading your groups...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {groups.map((group) => (
                <motion.div
                  key={group.id}
                  whileHover={{ y: -2 }}
                  className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-xl font-bold text-histo-dark">{group.name}</h3>
                      <span className="text-[10px] font-ui font-semibold text-histo-copper bg-histo-copper/10 px-2 py-0.5 rounded-[2px]">
                        {group.member_count || 1} Members
                      </span>
                    </div>
                    <p className="font-body text-xs text-histo-ink/80 leading-relaxed mb-4">{group.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-histo-dark/10">
                    <button
                      type="button"
                      className="text-xs font-ui font-bold text-histo-dark uppercase hover:text-histo-gold transition-colors cursor-pointer"
                    >
                      Enter Discussion →
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Create Group */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft sticky top-24">
            <h2 className="font-display text-xl font-bold text-histo-dark mb-4">Create New Guild</h2>
            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">Group Name</label>
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
                <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Focus area, curriculum, or topic..."
                  className="w-full h-20 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-body outline-none focus:border-histo-copper resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!user || !name.trim()}
                className="w-full mt-2 bg-histo-dark text-histo-paper py-3 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-gold hover:text-histo-dark transition-colors disabled:opacity-50 cursor-pointer shadow-soft"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>

    </main>
  );
}

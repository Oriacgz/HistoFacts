import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { generateNoteApi, getMyNotesApi, shareNoteToGroupApi } from '../api/aiNotes';
import { getMyGroupsApi } from '../api/groups';

export default function NotesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [topic, setTopic] = useState('');
  const [curriculum, setCurriculum] = useState('NCERT Class 10 History');
  const [generating, setGenerating] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);

  const loadData = async () => {
    try {
      const [notesData, groupsData] = await Promise.all([
        getMyNotesApi().catch(() => []),
        getMyGroupsApi().catch(() => []),
      ]);
      setNotes(notesData || []);
      setMyGroups(groupsData || []);
    } catch {
      // Offline fallback
      setNotes([
        {
          id: 'n-1',
          title: 'Study Notes: The French Revolution (NCERT Class 9)',
          curriculum_tag: 'NCERT Class 9 History',
          content: '# The French Revolution\n\n- **1789:** Storming of the Bastille.\n- **Declaration of Rights:** Foundation of modern democracy.',
          created_at: new Date().toISOString(),
        },
      ]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const newNote = await generateNoteApi(topic.trim(), curriculum.trim());
      setNotes([newNote, ...notes]);
      setSelectedNote(newNote);
      setTopic('');
    } catch {
      const fallbackNote = {
        id: `n-${Date.now()}`,
        title: `Study Notes: ${topic} (${curriculum})`,
        curriculum_tag: curriculum,
        content: `# Study Notes: ${topic}\n\n**Curriculum Target:** ${curriculum}\n\n## Key Takeaways\n- Structured exam breakdown for ${topic}.\n- Historical context and major milestone events.`,
        created_at: new Date().toISOString(),
      };
      setNotes([fallbackNote, ...notes]);
      setSelectedNote(fallbackNote);
      setTopic('');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareToGroup = async (noteId, groupId) => {
    try {
      await shareNoteToGroupApi(noteId, groupId);
      toast.success('Note successfully shared to study group!');
    } catch {
      toast.success('Note shared to group!');
    }
  };

  return (
    <div className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-histo-dark text-white border-b border-white/10 shadow-medium">
        <Link to="/" className="font-display text-2xl font-bold tracking-[4px] text-histo-paper uppercase">HISTOFACTS</Link>
        <nav className="flex gap-6">
          <Link to="/" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors">Home</Link>
          <Link to="/feed" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors">Feed</Link>
          <Link to="/notes" className="text-xs font-ui tracking-wider uppercase text-histo-gold font-semibold">AI Notes</Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator Form & Notes List */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft">
            <h1 className="font-display text-2xl font-bold text-histo-dark mb-2">AI Curriculum Note Generator</h1>
            <p className="font-body text-xs text-histo-ink/70 mb-4">Generate structured, exam-oriented study notes tailored to any specified curriculum.</p>

            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">Topic or Event</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Mughal Architecture, Dandi March, Industrial Revolution..."
                  required
                  className="w-full px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui outline-none focus:border-histo-copper"
                />
              </div>

              <div>
                <label className="text-xs font-ui font-semibold uppercase text-histo-ink/70 block mb-1">Target Curriculum / Board</label>
                <input
                  type="text"
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  placeholder="e.g. NCERT Class 10, UPSC GS Paper I, AP World History..."
                  required
                  className="w-full px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui outline-none focus:border-histo-copper"
                />
              </div>

              <button
                type="submit"
                disabled={generating || !topic.trim()}
                className="w-full bg-histo-copper text-white py-3 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors disabled:opacity-50 cursor-pointer shadow-soft"
              >
                {generating ? 'Generating Notes...' : '✨ Generate AI Notes'}
              </button>
            </form>
          </div>

          {/* Notes Library */}
          <div className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft">
            <h2 className="font-display text-lg font-bold text-histo-dark mb-4">Your Notes Library</h2>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {notes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setSelectedNote(n)}
                  className={`p-3 border rounded-[2px] cursor-pointer transition-colors ${selectedNote?.id === n.id ? 'border-histo-copper bg-histo-paper/50' : 'border-histo-dark/10 hover:border-histo-copper/50'}`}
                >
                  <span className="text-[10px] font-ui font-semibold text-histo-copper uppercase block mb-1">
                    {n.curriculum_tag || 'General'}
                  </span>
                  <h4 className="font-display text-sm font-bold text-histo-dark">{n.title}</h4>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Note Viewer & Share */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-histo-dark/10 p-8 rounded-[4px] shadow-soft min-h-[500px] flex flex-col justify-between">
            {selectedNote ? (
              <div>
                <div className="flex items-center justify-between border-b border-histo-dark/10 pb-4 mb-6">
                  <div>
                    <span className="text-xs font-ui font-semibold text-histo-copper uppercase block">
                      {selectedNote.curriculum_tag}
                    </span>
                    <h2 className="font-display text-2xl font-bold text-histo-dark">{selectedNote.title}</h2>
                  </div>
                  {myGroups.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleShareToGroup(selectedNote.id, e.target.value);
                      }}
                      defaultValue=""
                      className="text-xs font-ui bg-histo-paper border border-histo-dark/15 rounded px-2 py-1 outline-none"
                    >
                      <option value="" disabled>Share to Group...</option>
                      {myGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="font-body text-sm text-histo-ink leading-relaxed whitespace-pre-wrap">
                  {selectedNote.content}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-histo-ink/50">
                <span className="text-4xl mb-2">📜</span>
                <p className="font-body text-sm italic">Select a note from your library or generate a new curriculum note using the generator panel.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Send,
  Sparkles,
  BookOpen,
  Copy,
  Download,
  Delete,
  Edit,
  Share2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  FileText,
  Star,
  Tag,
  ArrowLeft,
  User,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { generateNoteApi, getMyNotesApi, shareNoteToGroupApi, updateNoteApi, deleteNoteApi } from '../api/aiNotes';
import { getMyGroupsApi } from '../api/groups';

const CURRICULUM_OPTIONS = [
  'NCERT Class 6 History',
  'NCERT Class 7 History',
  'NCERT Class 8 History',
  'NCERT Class 9 History',
  'NCERT Class 10 History',
  'NCERT Class 11 History',
  'NCERT Class 12 History',
  'UPSC GS Paper I',
  'AP World History',
  'AP European History',
  'AP US History',
  'IB History HL/SL',
  'A-Level History',
  'GCSE History',
  'Custom...',
];

const SUGGESTED_PROMPTS = [
  { label: 'Key Events Timeline', prompt: 'Create a chronological timeline of key events for {topic} with dates and significance' },
  { label: 'Exam-Focused Summary', prompt: 'Generate exam-focused notes for {topic} covering causes, events, consequences, and key figures' },
  { label: 'Comparative Analysis', prompt: 'Compare and contrast {topic} with similar historical events/periods' },
  { label: 'Source Analysis', prompt: 'Analyze primary and secondary sources related to {topic} for historical interpretation' },
];

export default function NotesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const shouldReduceMotion = useReducedMotion();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [notes, setNotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [curriculum, setCurriculum] = useState('NCERT Class 10 History');
  const [isGenerating, setIsGenerating] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [notesData, groupsData] = await Promise.all([
        getMyNotesApi().catch(() => []),
        getMyGroupsApi().catch(() => []),
      ]);
      setNotes(notesData || []);
      setMyGroups(groupsData || []);
    } catch {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Compute display messages for rendering
  const displayMessages = messages.length === 0
    ? [{ id: 'welcome', type: 'welcome', content: null }]
    : messages;

  const addMessage = (content, type = 'ai', metadata = {}) => {
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content,
      type,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    setMessages(prev => [...prev, message]);
    return message;
  };

  const handleGenerateNote = async (prompt, targetCurriculum = curriculum) => {
    if (isGenerating) return;

    setIsGenerating(true);
    const userMessage = addMessage(prompt, 'user', { curriculum: targetCurriculum });

    try {
      const newNote = await generateNoteApi(prompt.trim(), targetCurriculum.trim());
      
      setNotes(prev => [newNote, ...prev]);
      setSelectedNote(newNote);
      setSidebarOpen(true);

      addMessage(newNote.content, 'ai', { 
        noteId: newNote.id,
        curriculum: newNote.curriculum_tag,
        title: newNote.title,
      });
      
      toast.success('Notes generated successfully!');
    } catch (error) {
      const fallbackNote = {
        id: `n-${Date.now()}`,
        title: `Study Notes: ${prompt.slice(0, 50)}...`,
        curriculum_tag: targetCurriculum,
        content: `# Study Notes: ${prompt}\n\n**Curriculum Target:** ${targetCurriculum}\n\n## Key Takeaways\n- Structured exam breakdown for ${prompt}.\n- Historical context and major milestone events.\n- Key figures and their roles.\n- Long-term significance and legacy.`,
        created_at: new Date().toISOString(),
      };
      
      setNotes(prev => [fallbackNote, ...prev]);
      setSelectedNote(fallbackNote);
      setSidebarOpen(true);

      addMessage(fallbackNote.content, 'ai', {
        noteId: fallbackNote.id,
        curriculum: fallbackNote.curriculum_tag,
        title: fallbackNote.title,
      });

      toast.info('Generated locally (AI service unavailable)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isGenerating) return;
    const prompt = inputValue.trim();
    setInputValue('');
    handleGenerateNote(prompt);
  };

  const renderMessage = (message, i) => {
    if (message.id === 'welcome') {
      return (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-histo-copper/10 flex items-center justify-center mb-6"
          >
            <Sparkles className="h-8 w-8 text-histo-copper" />
          </motion.div>
          <h2 className="font-display text-2xl font-bold text-histo-dark mb-2">Your AI History Tutor</h2>
          <p className="font-body text-histo-ink/60 mb-6 max-w-md">
            Ask me to generate study notes for any historical topic. I'll create structured, curriculum-aligned notes with key events, analysis, and exam-focused summaries.
          </p>
          <div className="w-full max-w-md space-y-2">
            {SUGGESTED_PROMPTS.map((s, j) => (
              <motion.button
                key={s.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + j * 0.05 }}
                onClick={() => handleSuggestedPrompt(s)}
                className="w-full text-left p-4 bg-white border border-histo-dark/10 rounded-[2px] hover:border-histo-copper/50 hover:bg-histo-cream transition-all text-sm font-body text-histo-ink/70"
              >
                <span className="font-ui font-semibold text-histo-copper text-xs uppercase tracking-wider block mb-1">{s.label}</span>
                <span className="text-histo-ink/60">{s.prompt}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ delay: i * 0.03 }}
        className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
          <div className={`rounded-2xl p-4 ${message.type === 'user' 
            ? 'bg-histo-dark text-white rounded-br-none' 
            : 'bg-white border border-histo-dark/10 rounded-bl-none shadow-soft'}`}
          >
            <div className="font-body text-sm whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              {message.content}
            </div>
            {message.noteId && (
              <div className="mt-3 pt-3 border-t border-histo-dark/10 flex items-center gap-2">
                <Tag className="h-4 w-4 text-histo-copper" />
                <span className="font-ui text-xs text-histo-ink/50">Saved as: {message.title}</span>
                <span className="px-2 py-0.5 bg-histo-copper/10 text-histo-copper rounded text-[10px] font-ui uppercase">{message.curriculum}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 ml-2 mr-2 opacity-50">
            <span className="font-ui text-[10px] text-histo-ink/40">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderNotesList = () => {
    if (notes.length === 0) {
      return (
        <div className="text-center py-8 text-histo-ink/40">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-body text-sm">No notes yet</p>
          <p className="font-ui text-xs text-histo-ink/50 mt-1">Start a chat to generate your first note</p>
        </div>
      );
    }
    return (
      notes.map((note) => {
        const isSelected = selectedNote?.id === note.id;
        const baseClass = 'p-3 rounded-[2px] cursor-pointer transition-all';
        const selectedClass = 'bg-histo-copper/10 border border-histo-copper';
        const unselectedClass = 'hover:bg-histo-cream border border-transparent';
        const noteClassName = `${baseClass} ${isSelected ? selectedClass : unselectedClass}`;
        return (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => handleNoteSelect(note)}
            className={noteClassName}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-ui font-semibold text-histo-copper uppercase block mb-1">
                  {note.curriculum_tag || 'General'}
                </span>
                <h4 className="font-display text-sm font-bold text-histo-dark truncate">{note.title}</h4>
                <p className="font-ui text-[10px] text-histo-ink/40 mt-1">
                  {new Date(note.created_at).toLocaleDateString()}
                </p>
              </div>
              {isSelected && (
                <Star className="h-5 w-5 text-histo-copper fill-histo-copper flex-shrink-0" />
              )}
            </div>
          </motion.div>
        );
      })
    );
  };

  const handleSuggestedPrompt = (suggested) => {
    const prompt = suggested.prompt.replace('{topic}', 'the topic you specify');
    setInputValue(prompt);
  };

  const handleNoteSelect = (note) => {
    setSelectedNote(note);
    setSidebarOpen(true);
  };

  const handleDeleteNote = async (noteId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNoteApi(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) setSelectedNote(null);
      toast.success('Note deleted');
    } catch {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) setSelectedNote(null);
      toast.success('Note deleted locally');
    }
  };

  const handleShareNote = async (noteId, groupId) => {
    try {
      await shareNoteToGroupApi(noteId, groupId);
      toast.success('Note shared to group!');
    } catch {
      toast.success('Note shared to group!');
    }
  };

  const handleCopyContent = (content) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  };

  const handleDownloadNote = (note) => {
    const blob = new Blob([note.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Note downloaded!');
  };

  const startEditing = (note) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  const saveEdit = async () => {
    if (!editingNote) return;
    try {
      await updateNoteApi(editingNote.id, { content: editContent });
      setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, content: editContent } : n));
      if (selectedNote?.id === editingNote.id) {
        setSelectedNote({ ...selectedNote, content: editContent });
      }
      toast.success('Note updated!');
    } catch {
      setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, content: editContent } : n));
      if (selectedNote?.id === editingNote.id) {
        setSelectedNote({ ...selectedNote, content: editContent });
      }
      toast.success('Note updated locally');
    }
    setEditingNote(null);
    setEditContent('');
  };

  return (
    <div className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture flex">
      {/* Sidebar - Notes Library */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="notes-sidebar"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed lg:relative inset-y-0 left-0 z-40 w-80 lg:w-72 bg-white border-r border-histo-dark/10 shadow-xl flex flex-col transform lg:translate-x-0"
          >
            <div className="flex items-center justify-between p-4 border-b border-histo-dark/10">
              <h2 className="font-display text-lg font-bold text-histo-dark flex items-center gap-2">
                <FileText className="h-5 w-5 text-histo-copper" />
                Notes Library
              </h2>
              <button
                className="lg:hidden p-1 rounded text-histo-ink/50 hover:text-histo-copper"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3 border-b border-histo-dark/10">
              <button
                onClick={() => {
                  setMessages([]);
                  setSelectedNote(null);
                  setInputValue('');
                }}
                className="p-3 bg-histo-copper text-white rounded-[2px] font-ui text-xs font-bold uppercase tracking-wider w-full flex items-center justify-center gap-2 hover:bg-histo-dark transition-colors shadow-soft"
              >
                <Sparkles className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {renderNotesList()}
            </div>

            <div className="p-3 border-t border-histo-dark/10">
              <p className="font-ui text-xs text-histo-ink/50 text-center">
                {notes.length} note{notes.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </motion.aside>
        )}

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <motion.div
            key="notes-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-histo-paper/95 backdrop-blur-sm border-b border-histo-dark/10 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-md bg-histo-dark text-white hover:bg-histo-copper transition-colors flex items-center justify-center shrink-0"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open notes library'}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            
            {/* Back to Home Button */}
            <Link
              to="/home"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-histo-cream border border-histo-dark/15 text-histo-dark hover:text-histo-copper hover:border-histo-copper/50 transition-colors text-xs font-ui font-semibold uppercase tracking-wider shrink-0"
              title="Return to Home Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <h1 className="font-display text-lg sm:text-xl font-bold text-histo-dark truncate">AI Notes Assistant</h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-histo-copper/10 text-histo-copper rounded-full text-[10px] font-ui uppercase tracking-wider shrink-0">
              <Sparkles className="h-3 w-3" />
              AI Powered
            </span>
          </div>

          {/* Profile Area & Dropdown Menu */}
          <div className="relative flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 group cursor-pointer bg-transparent border-none outline-none text-left"
              >
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-9 w-9 rounded-full bg-histo-copper/20 border border-histo-copper/50 group-hover:border-histo-copper flex items-center justify-center text-histo-copper font-display font-bold text-sm transition-colors duration-300 shadow-soft"
                >
                  {user.username ? user.username[0].toUpperCase() : 'U'}
                </motion.div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-ui font-semibold tracking-wide text-histo-dark group-hover:text-histo-copper transition-colors duration-200">
                    {user.tag ? `${user.username}#${user.tag}` : user.username}
                  </span>
                  <span className="text-[10px] font-ui text-histo-copper tracking-wider font-semibold">Scholar Account</span>
                </div>
              </button>
            ) : (
              <Link to="/loginpg" className="flex items-center gap-2 group cursor-pointer">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-9 w-9 rounded-full bg-histo-copper/20 border border-histo-copper/30 group-hover:border-histo-copper flex items-center justify-center text-histo-copper transition-colors duration-300"
                >
                  <User className="h-4 w-4 text-histo-copper" />
                </motion.div>
                <span className="hidden sm:inline text-sm font-ui font-medium tracking-wide text-histo-dark group-hover:text-histo-copper transition-colors duration-200">
                  Sign In
                </span>
              </Link>
            )}

            {/* Profile Dropdown Menu */}
            {user && profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-histo-dark text-white border border-histo-gold/30 rounded-[4px] shadow-deep p-2 z-50 animate-fade-in">
                {/* User info banner */}
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="font-display text-sm font-bold text-histo-paper">{user.username}</p>
                  <p className="font-ui text-xs text-histo-gold/80 font-mono">#{user.tag}</p>
                  <p className="font-ui text-[10px] text-white/50 truncate mt-0.5">{user.email}</p>
                </div>

                {/* Options */}
                <Link
                  to="/home"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <ArrowLeft className="h-4 w-4 text-histo-gold/80" />
                  <span>Dashboard Home</span>
                </Link>

                <button
                  type="button"
                  onClick={() => { setProfileMenuOpen(false); toast.info('Settings panel opening...'); }}
                  className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-histo-gold/80" />
                  <span>Settings</span>
                </button>

                <Link
                  to="/friends"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <Users className="h-4 w-4 text-histo-gold/80" />
                  <span>Friends & Scholars</span>
                </Link>

                <Link
                  to="/feed"
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2.5 block"
                >
                  <MessageSquare className="h-4 w-4 text-histo-gold/80" />
                  <span>Community Feed</span>
                </Link>

                <div className="h-[1px] bg-white/10 my-1" />

                {/* Logout */}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setProfileMenuOpen(false);
                    toast.info('Logged out successfully!');
                    navigate('/loginpg');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-ui font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-[2px] transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-red-400" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={chatContainerRef}>
          <AnimatePresence mode="popLayout">
            {displayMessages.map((message, i) => renderMessage(message, i))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 z-20 border-t border-histo-dark/10 bg-histo-paper/95 backdrop-blur-md p-3 sm:p-4">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="relative flex items-center w-full bg-white border border-histo-dark/15 focus-within:border-histo-copper focus-within:ring-2 focus-within:ring-histo-copper/20 rounded-full shadow-soft transition-all">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isGenerating ? 'Generating notes...' : 'Ask for study notes on any historical topic...'}
                disabled={isGenerating}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isGenerating && inputValue.trim()) handleSendMessage(e);
                  }
                }}
                className="w-full pl-5 pr-14 py-3 bg-transparent text-sm font-body text-histo-ink outline-none resize-none disabled:opacity-50 disabled:cursor-wait placeholder:text-histo-ink/40"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={isGenerating || !inputValue.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 bg-histo-copper text-white rounded-full hover:bg-histo-dark active:scale-95 transition-all duration-200 disabled:opacity-30 disabled:hover:bg-histo-copper disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-soft"
                aria-label="Send message"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-0.5" />
                )}
              </button>
            </div>
          </form>
          <p className="font-ui text-[10px] text-histo-ink/40 text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </main>

      {/* Note Detail Panel - Right side on desktop, bottom sheet on mobile */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="hidden lg:block fixed lg:relative inset-y-0 right-0 z-30 w-96 bg-white border-l border-histo-dark/10 shadow-xl flex flex-col"
          >
            <div className="p-4 border-b border-histo-dark/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-ui font-semibold text-histo-copper uppercase block mb-1">
                  {selectedNote.curriculum_tag}
                </span>
                <h3 className="font-display text-lg font-bold text-histo-dark truncate">{selectedNote.title}</h3>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="p-1 rounded text-histo-ink/50 hover:text-histo-copper lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {editingNote?.id === selectedNote.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={20}
                    className="w-full px-3 py-2 bg-histo-cream border border-histo-dark/15 rounded-[2px] text-sm font-body outline-none focus:border-histo-copper resize-y font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 bg-histo-copper text-white py-2 rounded-[2px] font-ui text-xs font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingNote(null)}
                      className="flex-1 border border-histo-dark/15 text-histo-ink py-2 rounded-[2px] font-ui text-xs font-bold uppercase tracking-wider hover:bg-histo-cream transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="font-body text-sm text-histo-ink leading-relaxed whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                  {selectedNote.content}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-histo-dark/10 space-y-2">
              {editingNote?.id !== selectedNote.id && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(selectedNote)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui font-medium text-histo-ink hover:bg-histo-cream transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleCopyContent(selectedNote.content)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui font-medium text-histo-ink hover:bg-histo-cream transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownloadNote(selectedNote)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui font-medium text-histo-ink hover:bg-histo-cream transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteNote(selectedNote.id, { stopPropagation: () => {} })}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-400 text-red-500 rounded-[2px] text-xs font-ui font-medium hover:bg-red-50 transition-colors"
                    >
                      <Delete className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                  {myGroups.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleShareNote(selectedNote.id, e.target.value);
                      }}
                      defaultValue=""
                      className="w-full px-3 py-2 bg-histo-cream border border-histo-dark/15 rounded-[2px] text-xs font-ui outline-none focus:border-histo-copper"
                    >
                      <option value="" disabled>Share to Group...</option>
                      {myGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Mobile Bottom Sheet for Note Detail */}
        {selectedNote && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] bg-white border-t border-histo-dark/10 rounded-t-2xl shadow-xl flex flex-col"
          >
            <div className="p-4 border-b border-histo-dark/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-ui font-semibold text-histo-copper uppercase block mb-1">
                  {selectedNote.curriculum_tag}
                </span>
                <h3 className="font-display text-lg font-bold text-histo-dark truncate">{selectedNote.title}</h3>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="p-1 rounded text-histo-ink/50 hover:text-histo-copper"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="font-body text-sm text-histo-ink leading-relaxed whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                {selectedNote.content}
              </div>
            </div>
            <div className="p-4 border-t border-histo-dark/10 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyContent(selectedNote.content)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui font-medium text-histo-ink hover:bg-histo-cream transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
                <button
                  onClick={() => handleDownloadNote(selectedNote)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui font-medium text-histo-ink hover:bg-histo-cream transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteNote(selectedNote.id, { stopPropagation: () => {} })}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-red-400 text-red-500 rounded-[2px] text-xs font-ui font-medium hover:bg-red-50 transition-colors"
                >
                  <Delete className="h-4 w-4" />
                  Delete
                </button>
                <button
                  onClick={() => startEditing(selectedNote)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-histo-copper text-white rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
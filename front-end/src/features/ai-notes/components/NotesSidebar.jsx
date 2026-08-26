import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

export default function NotesSidebar({
  isOpen,
  onClose,
  notes,
  activeNoteId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectNote,
  onDeleteNote,
}) {
  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return n.title && n.title.toLowerCase().includes(q);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.aside
            key="notes-sidebar"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-white border-r border-histo-dark/10 shadow-xl flex flex-col shrink-0"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-histo-dark/10 min-h-[64px]">
              <h2 className="font-display text-lg font-bold text-histo-dark flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-histo-copper" />
                Notes Library
              </h2>
              <button
                type="button"
                className="lg:hidden p-2 rounded-lg hover:bg-histo-cream text-histo-ink/60 hover:text-histo-dark cursor-pointer"
                onClick={onClose}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3 border-b border-histo-dark/10">
              <button
                type="button"
                onClick={onNewChat}
                className="p-3 bg-histo-copper text-white rounded-[4px] font-ui text-xs font-bold uppercase tracking-wider w-full flex items-center justify-center gap-2 hover:bg-histo-dark transition-all shadow-soft active:scale-98 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-histo-dark/10">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-histo-ink/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search past notes..."
                  className="w-full pl-8 pr-3 py-1.5 bg-histo-cream/60 border border-histo-dark/10 rounded-[4px] text-xs font-ui text-histo-ink placeholder:text-histo-ink/40 outline-none focus:border-histo-copper"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2 text-histo-ink/40 hover:text-histo-ink cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-histo-ink/40">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-body text-xs">
                    {searchQuery ? 'No matching notes' : 'No notes saved yet'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = activeNoteId === note.id;
                  const isHandwritten = note.style === 'handwritten' || note.title.toLowerCase().includes('handwritten');
                  return (
                    <div
                      key={note.id}
                      onClick={() => onSelectNote(note)}
                      className={`group p-2.5 rounded-[4px] cursor-pointer transition-all border flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-histo-copper/10 border-histo-copper shadow-xs'
                          : 'bg-white hover:bg-histo-cream/60 border-histo-dark/10 hover:border-histo-copper/40'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isHandwritten && (
                            <span className="text-[9px] font-ui px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-semibold flex items-center gap-0.5">
                              ✍️ Hand
                            </span>
                          )}
                          <h4 className="font-display text-xs font-bold text-histo-dark truncate leading-tight group-hover:text-histo-copper transition-colors">
                            {note.title.replace(/^Study Notes:\s*/, '').replace(/^Handwritten Notes:\s*/, '')}
                          </h4>
                        </div>
                        <p className="font-ui text-[10px] text-histo-ink/40 mt-0.5">
                          {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Today'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => onDeleteNote(note.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-histo-ink/40 hover:text-red-500 rounded transition-opacity cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-histo-dark/10 bg-histo-cream/30">
              <p className="font-ui text-xs text-histo-ink/60 text-center">
                {notes.length} note{notes.length !== 1 ? 's' : ''} in library
              </p>
            </div>
          </motion.aside>

          {/* Mobile Backdrop */}
          <motion.div
            key="notes-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-xs"
            onClick={onClose}
          />
        </>
      )}
    </AnimatePresence>
  );
}

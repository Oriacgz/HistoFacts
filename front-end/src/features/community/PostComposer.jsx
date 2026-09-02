import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Send, Sparkles, Hash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function PostComposer({ onPostCreated, disabled = false }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showTitleField, setShowTitleField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || submitting || !user) return;

    setSubmitting(true);
    setError(null);
    try {
      await onPostCreated({
        content: content.trim(),
        title: title.trim() ? title.trim() : null,
      });
      setContent('');
      setTitle('');
      setShowTitleField(false);
    } catch (err) {
      console.error('Failed to publish post:', err);
      setError(err?.message || 'Failed to publish post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = content.length;
  const maxChars = 3000;

  return (
    <div className="bg-white border border-histo-dark/15 rounded-xl shadow-soft p-5 md:p-6 mb-8 transition-all hover:border-histo-copper/30">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-histo-dark/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-histo-paper border border-histo-copper/30 flex items-center justify-center font-display font-bold text-histo-dark text-sm shadow-inner">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              user?.username?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div>
            <h3 className="font-ui font-semibold text-sm text-histo-dark">
              {user ? user.username : 'Guest Scholar'}
              {user?.tag && <span className="text-histo-ink/40 font-normal text-xs ml-1">#{user.tag}</span>}
            </h3>
            <p className="text-[11px] font-ui text-histo-ink/60">Contribute to the historical chronicle</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTitleField(!showTitleField)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-ui transition-colors ${
            showTitleField
              ? 'bg-histo-copper/10 text-histo-copper font-medium border border-histo-copper/30'
              : 'text-histo-ink/60 hover:text-histo-dark hover:bg-histo-paper'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          {showTitleField ? 'Remove Headline' : 'Add Headline'}
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-ui">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <AnimatePresence>
          {showTitleField && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Thread Headline or Thesis (e.g. 'The Real Impact of the Library of Alexandria')"
                maxLength={200}
                disabled={!user || submitting}
                className="w-full px-3.5 py-2.5 bg-histo-paper/50 border border-histo-dark/15 rounded-lg text-sm font-display font-semibold text-histo-dark placeholder:text-histo-ink/40 outline-none focus:border-histo-copper focus:bg-white transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            user
              ? `Share a historical insight, discovery, or question, ${user.username}...`
              : 'Please log in to participate in scholar discussions.'
          }
          disabled={!user || submitting || disabled}
          rows={3}
          maxLength={maxChars}
          className="w-full p-3.5 bg-histo-paper/40 border border-histo-dark/15 rounded-lg text-sm font-body text-histo-ink placeholder:text-histo-ink/40 outline-none focus:border-histo-copper focus:bg-white resize-y min-h-[90px] transition-all"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] font-ui ${
                charCount > maxChars * 0.9 ? 'text-histo-danger font-medium' : 'text-histo-ink/40'
              }`}
            >
              {charCount} / {maxChars}
            </span>
          </div>

          <button
            type="submit"
            disabled={!user || !content.trim() || submitting || disabled}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-histo-copper text-white font-ui font-semibold text-xs tracking-wide shadow-sm hover:bg-histo-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Publish Chronicle
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold,
  Code2,
  Hash,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  MoreHorizontal,
  PlayCircle,
  Quote,
  Send,
  Smile,
  Strikethrough,
  Table2,
  Type,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import EmojiPickerPopover from './EmojiPickerPopover';

const MAX_IMAGES_PER_POST = 4;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// Thumbnail strip for files staged for upload, with per-item remove.
function MediaPreviewStrip({ items, onRemove }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map(({ file, url }) => (
        <div key={url} className="relative">
          {file.type.startsWith('video/') ? (
            <video src={url} muted className="h-20 w-28 rounded-lg border border-histo-dark/10 object-cover" />
          ) : (
            <img src={url} alt={file.name} className="h-20 w-28 rounded-lg border border-histo-dark/10 object-cover" />
          )}
          <button
            type="button"
            onClick={() => onRemove(url)}
            title="Remove"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-histo-dark text-white shadow-sm hover:bg-red-600 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function PostComposer({ onPostCreated, disabled = false, modal = false, onClose }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showTitleField, setShowTitleField] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // [{ file, url }]
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const contentRef = useRef(null);
  const pendingRef = useRef(pendingFiles);

  // Mirror staged files into a ref so the unmount cleanup revokes what's current
  useEffect(() => {
    pendingRef.current = pendingFiles;
  }, [pendingFiles]);

  // Revoke any preview object URLs still staged on unmount
  useEffect(() => () => {
    pendingRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
  }, []);

  // Images and video are mutually exclusive: staging a video replaces staged images, and vice versa
  const stageFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    setError(null);
    const hasVideo = incoming.some((f) => f.type.startsWith('video/'));

    if (hasVideo) {
      if (incoming.length > 1) {
        setError('A post can carry one video or up to 4 images — not both.');
        return;
      }
      const video = incoming[0];
      if (video.size > MAX_VIDEO_BYTES) {
        setError('Video too large (max 100MB).');
        return;
      }
      pendingRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
      setPendingFiles([{ file: video, url: URL.createObjectURL(video) }]);
      return;
    }

    if (incoming.some((f) => !f.type.startsWith('image/'))) {
      setError('Only image files can be staged here.');
      return;
    }

    // Carried-over images keep their object URLs; only a replaced video is revoked
    const carried = pendingFiles.filter((p) => !p.file.type.startsWith('video/'));
    pendingFiles
      .filter((p) => p.file.type.startsWith('video/'))
      .forEach(({ url }) => URL.revokeObjectURL(url));
    const merged = [
      ...carried,
      ...incoming.slice(0, MAX_IMAGES_PER_POST - carried.length),
    ].map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPendingFiles(merged);
  };

  const removePending = (url) => {
    URL.revokeObjectURL(url);
    setPendingFiles((prev) => prev.filter((p) => p.url !== url));
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!content.trim() && pendingFiles.length === 0) || submitting || !user) return;

    setSubmitting(true);
    setError(null);
    try {
      await onPostCreated({
        content: content.trim(),
        title: title.trim() ? title.trim() : null,
        files: pendingFiles.map((p) => p.file),
      });
      setContent('');
      setTitle('');
      setShowTitleField(false);
      pendingFiles.forEach(({ url }) => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to publish post:', err);
      setError(err?.message || 'Failed to publish post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const insertFormatting = (prefix, suffix = prefix) => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || 'text';
    const nextContent = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    setContent(nextContent);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const charCount = content.length;
  const maxChars = 3000;

  return (
    <div className={modal ? 'w-full rounded-2xl border border-histo-dark/15 bg-white p-5 text-histo-dark shadow-deep sm:p-6 md:p-7' : 'mb-8 rounded-2xl border border-histo-dark/15 bg-white p-5 shadow-soft transition-all hover:border-histo-copper/30 md:p-6'}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-histo-dark/10 pb-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="sm" />
          <div>
            <h3 className="text-sm font-ui font-semibold text-histo-dark">
              {user ? user.username : 'Guest Scholar'}
              {user?.tag && <span className="ml-1 text-xs font-normal text-histo-ink/50">#{user.tag}</span>}
            </h3>
            <p className="text-xs font-ui text-histo-ink/60">{modal ? 'Create a new chronicle discussion' : 'Contribute to the historical chronicle'}</p>
          </div>
        </div>

        {modal ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-histo-ink/50 transition-colors hover:bg-histo-paper hover:text-histo-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40 cursor-pointer"
            aria-label="Close create post dialog"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowTitleField(!showTitleField)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-ui transition-colors cursor-pointer ${
              showTitleField
                ? 'bg-histo-copper/10 text-histo-copper font-medium border border-histo-copper/30'
                : 'text-histo-ink/60 hover:text-histo-dark hover:bg-histo-paper'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            {showTitleField ? 'Remove Title' : 'Add Title'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-ui">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <AnimatePresence>
          {(showTitleField || modal) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {modal && (
                <label htmlFor="chronicle-title" className="mb-1.5 block text-xs font-ui font-semibold text-histo-dark">
                  Post Title <span className="text-histo-copper">*</span>
                </label>
              )}
              <input
                id={modal ? 'chronicle-title' : undefined}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={modal ? 'What is your question or topic title?' : "Discussion Title (e.g. 'The Real Impact of the Library of Alexandria')"}
                maxLength={200}
                disabled={!user || submitting}
                className="w-full rounded-xl border border-histo-dark/15 bg-histo-paper/50 px-4 py-2.5 text-sm font-display font-semibold text-histo-dark outline-none transition-all placeholder:text-histo-ink/40 focus:border-histo-copper focus:bg-white focus:ring-2 focus:ring-histo-copper/20"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={user ? (modal ? 'Share your thoughts, historical context, or sources (optional)...' : 'What historical topic would you like to discuss?') : 'Please log in to join discussions.'}
          disabled={!user || submitting || disabled}
          rows={3}
          maxLength={maxChars}
          className="w-full resize-y rounded-xl border border-histo-dark/15 bg-histo-paper/30 p-3.5 sm:p-4 font-body text-sm sm:text-base text-histo-ink outline-none transition-all placeholder:text-histo-ink/40 focus:border-histo-copper focus:bg-white focus:ring-2 focus:ring-histo-copper/20 min-h-32 sm:min-h-36"
        />

        {modal && (
          <div className="flex flex-wrap items-center gap-1 border-y border-histo-dark/10 py-2 text-histo-ink/65">
            <button type="button" onClick={() => insertFormatting('[', ']')} title="Add link" className="format-tool"><Link className="h-4 w-4" /></button>
            <button type="button" onClick={() => imageInputRef.current?.click()} title="Add image" className="format-tool"><ImageIcon className="h-4 w-4" /></button>
            <button type="button" onClick={() => videoInputRef.current?.click()} title="Add video" className="format-tool"><PlayCircle className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-histo-dark/10" />
            <button type="button" onClick={() => insertFormatting('**')} title="Bold" className="format-tool"><Bold className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('*')} title="Italic" className="format-tool"><Italic className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('~~')} title="Strikethrough" className="format-tool"><Strikethrough className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('^')} title="Superscript" className="format-tool"><Type className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-histo-dark/10" />
            <button type="button" onClick={() => insertFormatting('- ', '')} title="Bulleted list" className="format-tool"><List className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('1. ', '')} title="Numbered list" className="format-tool"><ListOrdered className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('`')} title="Inline code" className="format-tool"><Code2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('> ', '')} title="Quote" className="format-tool"><Quote className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertFormatting('| ', '')} title="Table row" className="format-tool"><Table2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="More tools" className="format-tool"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        )}

        {pendingFiles.length > 0 && (
          <MediaPreviewStrip items={pendingFiles} onRemove={removePending} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 relative">
            {/* Media buttons — one or the other, never both */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                stageFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                stageFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={!user || submitting}
              title="Add images (up to 4)"
              aria-label="Add images up to 4"
              className="cursor-pointer rounded-full p-2 transition-colors disabled:opacity-40 text-histo-copper hover:bg-histo-copper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={!user || submitting}
              title="Add a video (max 100MB)"
              aria-label="Add a video up to 100MB"
              className="cursor-pointer rounded-full p-2 transition-colors disabled:opacity-40 text-histo-copper hover:bg-histo-copper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
            >
              <Video className="w-5 h-5" />
            </button>

            {/* Emoji — the shared emoji-picker-react instance */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={!user || submitting}
                title="Add emoji"
                aria-label="Add emoji"
                className="cursor-pointer rounded-full p-2 transition-colors disabled:opacity-40 text-histo-copper hover:bg-histo-copper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
              >
                <Smile className="w-5 h-5" />
              </button>
              <EmojiPickerPopover
                open={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiClick={(emoji) => setContent((c) => c + emoji)}
              />
            </div>

            <span
              className={`ml-1 text-[11px] font-ui ${
                charCount > maxChars * 0.9 ? 'font-medium text-histo-danger' : 'text-histo-ink/45'
              }`}
            >
              {charCount} / {maxChars}
            </span>

            <span className="hidden md:inline text-[10px] font-ui text-histo-ink/35 italic">
              Ctrl+Enter to publish
            </span>
          </div>

          <div className="flex items-center gap-2">
            {modal && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-full border border-histo-dark/15 text-xs font-ui font-medium text-histo-dark hover:bg-histo-paper transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!user || (!content.trim() && pendingFiles.length === 0) || submitting || disabled}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-histo-copper px-5 py-2 text-xs font-ui font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-histo-dark disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-histo-copper/40"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Publish Post
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

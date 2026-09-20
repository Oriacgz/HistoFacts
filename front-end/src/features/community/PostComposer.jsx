import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Image as ImageIcon, Send, Smile, Video, X } from 'lucide-react';
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

export default function PostComposer({ onPostCreated, disabled = false }) {
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

  const charCount = content.length;
  const maxChars = 3000;

  return (
    <div className="bg-white border border-histo-dark/15 rounded-xl shadow-soft p-5 md:p-6 mb-8 transition-all hover:border-histo-copper/30">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-histo-dark/10">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="sm" />
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
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-ui transition-colors cursor-pointer ${
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
          placeholder={user ? "What's happening in history?" : 'Please log in to participate in scholar discussions.'}
          disabled={!user || submitting || disabled}
          rows={3}
          maxLength={maxChars}
          className="w-full p-3.5 bg-transparent border-none text-base md:text-lg font-body text-histo-ink placeholder:text-histo-ink/40 outline-none resize-y min-h-[70px] transition-all"
        />

        {pendingFiles.length > 0 && (
          <MediaPreviewStrip items={pendingFiles} onRemove={removePending} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
              className="p-2 rounded-full text-histo-copper hover:bg-histo-copper/10 transition-colors cursor-pointer disabled:opacity-40"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={!user || submitting}
              title="Add a video (max 100MB)"
              className="p-2 rounded-full text-histo-copper hover:bg-histo-copper/10 transition-colors cursor-pointer disabled:opacity-40"
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
                className="p-2 rounded-full text-histo-copper hover:bg-histo-copper/10 transition-colors cursor-pointer disabled:opacity-40"
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
                charCount > maxChars * 0.9 ? 'text-histo-danger font-medium' : 'text-histo-ink/40'
              }`}
            >
              {charCount} / {maxChars}
            </span>
          </div>

          <button
            type="submit"
            disabled={!user || (!content.trim() && pendingFiles.length === 0) || submitting || disabled}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-histo-copper text-white font-ui font-semibold text-xs tracking-wide shadow-sm hover:bg-histo-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Post
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

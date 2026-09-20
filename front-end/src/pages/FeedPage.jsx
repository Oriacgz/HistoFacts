import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronUp,
  Clock3,
  Compass,
  Flame,
  Gamepad2,
  HelpCircle,
  Home,
  PenLine,
  Plus,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  getPublicFeedApi,
  getPostDetailApi,
  createPostApi,
  uploadPostMediaApi,
  reactToPostApi,
  deletePostApi,
  addCommentApi,
  deleteCommentApi,
  sharePostApi,
} from '../api/social';

import {
  PostComposer,
  PostCard,
  ShareModal,
  DeleteConfirmModal,
} from '../features/community';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [activeTab, setActiveTab] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [sharingPost, setSharingPost] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    if (!showCreatePost) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowCreatePost(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreatePost]);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicFeedApi({ limit: 50 });
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setError('Unable to load chronicle discussions. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // 1. Create Post (then attach any staged media)
  const handleCreatePost = async ({ content, title, files }) => {
    const created = await createPostApi(content, { title });
    let final = created;
    if (files?.length) {
      try {
        const res = await uploadPostMediaApi(created.id, files);
        final = { ...created, media_urls: res.media_urls, media_type: res.media_type };
      } catch (err) {
        // Post text is already live; surface the media failure without losing the post
        console.error('Failed to upload post media:', err);
        throw err;
      }
    }
    setPosts((prev) => [final, ...prev]);
    setShowCreatePost(false);
  };

  // 2. React to Post (optimistic update, server-confirmed)
  const handlePostReaction = async (postId, reaction) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likes: (p.likes || 0) - (p.user_reaction === 'like' ? 1 : 0) + (reaction === 'like' ? 1 : 0),
              dislikes: (p.dislikes || 0) - (p.user_reaction === 'dislike' ? 1 : 0) + (reaction === 'dislike' ? 1 : 0),
              user_reaction: reaction === 'none' ? null : reaction,
            }
          : p
      )
    );

    try {
      const res = await reactToPostApi(postId, reaction);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, ...res } : p
        )
      );
    } catch (err) {
      console.error('Failed to react to post:', err);
      loadFeed(); // revert on failure
    }
  };

  // 3. Load Comments for a Post
  const handleLoadComments = async (postId) => {
    try {
      const updatedPost = await getPostDetailApi(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
      );
    } catch (err) {
      console.error('Failed to load post comments:', err);
    }
  };

  // 4. Add Comment / Reply (optionally with a GIF URL attached)
  const handleAddComment = async (postId, content, parentCommentId = null, mediaUrl = null) => {
    await addCommentApi(postId, content, {
      parentCommentId,
      mediaUrl,
    });

    // Refresh post details to update threaded comments
    await handleLoadComments(postId);
  };

  // 4. Delete Comment
  const handleDeleteComment = async (postId, commentId) => {
    await deleteCommentApi(postId, commentId);
    const updatedPost = await getPostDetailApi(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
    );
  };

  // 5. Delete Post
  const handleConfirmDeletePost = async () => {
    if (!deletingPostId) return;
    setIsDeleting(true);
    try {
      await deletePostApi(deletingPostId);
      setPosts((prev) => prev.filter((p) => p.id !== deletingPostId));
      setDeletingPostId(null);
    } catch (err) {
      console.error('Failed to delete post:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // 6. Share Post
  const handleSharePost = async (postId, { shareChannel, caption }) => {
    try {
      const res = await sharePostApi(postId, { shareChannel, caption });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, share_count: res.new_share_count } : p
        )
      );
    } catch (err) {
      console.error('Failed to share post:', err);
    }
  };

  // Filtered & Sorted Posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.content?.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.author?.username?.toLowerCase().includes(q)
      );
    }

    // Sort popular posts by net reaction score.
    if (activeTab === 'popular') {
      result.sort((a, b) => ((b.likes || 0) - (b.dislikes || 0)) - ((a.likes || 0) - (a.dislikes || 0)) || (b.comment_count || 0) - (a.comment_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [posts, activeTab, searchQuery]);

  return (
    <main className="relative flex-1 bg-histo-paper/70 px-3 pb-12 pt-4 sm:px-5 lg:px-8">
      <div className="sticky top-3 z-30 mx-auto mb-7 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-histo-dark/10 bg-white/95 px-3 py-2.5 shadow-medium backdrop-blur-md sm:px-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('latest')}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-ui font-semibold transition-colors ${activeTab === 'latest' ? 'bg-histo-dark text-white shadow-sm' : 'text-histo-ink/60 hover:bg-histo-paper hover:text-histo-dark'}`}
          >
            <Clock3 className="h-4 w-4" /> Latest
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('popular')}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-ui font-semibold transition-colors ${activeTab === 'popular' ? 'bg-histo-dark text-white shadow-sm' : 'text-histo-ink/60 hover:bg-histo-paper hover:text-histo-dark'}`}
          >
            <Flame className="h-4 w-4" /> Trending
          </button>
        </div>

        <div className="relative order-3 w-full sm:order-0 sm:w-auto sm:flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-histo-ink/40" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the chronicle"
            aria-label="Search the chronicle"
            className="h-9 w-full rounded-xl border border-histo-dark/10 bg-histo-paper/60 pl-9 pr-3 text-xs font-ui text-histo-dark outline-none transition-colors placeholder:text-histo-ink/40 focus:border-histo-copper focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowCreatePost(true)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-histo-copper px-3.5 text-xs font-ui font-semibold text-white shadow-sm transition-colors hover:bg-histo-dark"
        >
          <Plus className="h-4 w-4" /> Create post
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-7 lg:grid-cols-[220px_minmax(0,680px)_260px] lg:justify-center">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-histo-dark/10 bg-white px-2.5 py-3 text-histo-ink shadow-soft">
            <nav className="space-y-1">
              {[
                { label: 'Home', icon: Home, active: activeTab === 'latest', action: () => setActiveTab('latest') },
                { label: 'Popular', icon: TrendingUp, active: activeTab === 'popular', action: () => setActiveTab('popular') },
                { label: 'News', icon: BookOpen, active: false, action: () => {} },
                { label: 'Explore', icon: Compass, active: false, action: () => {} },
              ].map(({ label, icon: Icon, active, action }) => (
                <button key={label} type="button" onClick={action} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-ui transition-colors ${active ? 'bg-histo-paper text-histo-dark shadow-soft' : 'text-histo-ink/70 hover:bg-histo-paper hover:text-histo-dark'}`}>
                  <Icon className={`h-4 w-4 ${active ? 'text-histo-gold' : ''}`} />
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => setShowCreatePost(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-ui text-histo-ink/70 transition-colors hover:bg-histo-paper hover:text-histo-dark">
                <Plus className="h-4 w-4" /> Start a chronicle
              </button>
            </nav>

            {[
              { label: 'GAMES ON HISTOFACTS', icon: Gamepad2, items: ['History Quiz', 'Daily Challenge'] },
              { label: 'RECENT', icon: Clock3, items: ['Latest chronicles', 'Your discussions'] },
              { label: 'COMMUNITIES', icon: Users, items: ['History lounge', 'Scholar circles'] },
              { label: 'RESOURCES', icon: HelpCircle, items: ['About HistoFacts', 'Help & guidelines'] },
            ].map(({ label, icon: Icon, items }) => (
              <details key={label} open className="mt-3 border-t border-histo-dark/10 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[10px] font-ui font-semibold tracking-[0.12em] text-histo-ink/45">
                  {label}
                  <ChevronUp className="h-3.5 w-3.5" />
                </summary>
                <div className="space-y-1">
                  {items.map((item) => (
                    <button key={item} type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-ui text-histo-ink/65 transition-colors hover:bg-histo-paper hover:text-histo-dark">
                      <Icon className="h-3.5 w-3.5" /> {item}
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </aside>

        <section className="min-w-0 lg:w-[680px]">
          <div className="mb-4 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="mb-1 text-[10px] font-ui font-bold uppercase tracking-[0.18em] text-histo-copper">Community forum</p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-histo-dark sm:text-4xl">Chronicle feed</h1>
            </div>
            <button type="button" onClick={() => setShowCreatePost(true)} className="hidden items-center gap-1.5 text-xs font-ui font-semibold text-histo-copper hover:text-histo-dark sm:inline-flex">
              <PenLine className="h-3.5 w-3.5" /> Write
            </button>
          </div>

          {/* Error Message */}
          {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-ui flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={loadFeed}
            className="underline font-semibold hover:text-red-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

          {/* Posts Feed */}
          {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-histo-dark/10 rounded-xl p-6 shadow-soft animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-histo-paper" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-histo-paper rounded w-1/4" />
                  <div className="h-3 bg-histo-paper rounded w-1/6" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-histo-paper rounded w-full" />
                <div className="h-4 bg-histo-paper rounded w-5/6" />
              </div>
              <div className="h-8 bg-histo-paper/60 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-16 text-center bg-white border border-histo-dark/10 rounded-xl shadow-soft p-8">
          <div className="w-12 h-12 rounded-full bg-histo-paper text-histo-copper mx-auto flex items-center justify-center text-xl mb-3">
            📜
          </div>
          <h3 className="font-display font-bold text-lg text-histo-dark mb-1">
            No Chronicles Found
          </h3>
          <p className="font-body text-xs md:text-sm text-histo-ink/60 max-w-sm mx-auto">
            {searchQuery
              ? `No discussions match "${searchQuery}". Try a different keyword.`
              : 'Be the first scholar to initiate a historical thread above!'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onReaction={handlePostReaction}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onDeletePost={(id) => setDeletingPostId(id)}
                onOpenShare={(p) => setSharingPost(p)}
                onLoadComments={handleLoadComments}
              />
            ))}
          </AnimatePresence>
        </div>
          )}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-histo-dark/10 bg-white/75 shadow-soft">
            <div className="flex items-center justify-between border-b border-histo-dark/10 px-4 py-3">
              <h2 className="text-[11px] font-ui font-bold uppercase tracking-[0.12em] text-histo-dark">Recent posts</h2>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Live" />
            </div>
            <div className="divide-y divide-histo-dark/10">
              {posts.slice(0, 5).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-histo-paper/70"
                >
                  <p className="line-clamp-2 text-xs font-body leading-relaxed text-histo-dark">{post.title || post.content}</p>
                  <p className="mt-1.5 text-[10px] font-ui text-histo-ink/45">{post.author?.username || 'Scholar'} · {post.comment_count || 0} replies</p>
                </button>
              ))}
              {!posts.length && <p className="px-4 py-5 text-xs font-ui text-histo-ink/45">Recent discussions will appear here.</p>}
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showCreatePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#090b0d]/75 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-12"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowCreatePost(false);
            }}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-3xl"
              role="dialog"
              aria-modal="true"
              aria-label="Create a chronicle post"
            >
              <PostComposer
                modal
                onClose={() => setShowCreatePost(false)}
                onPostCreated={handleCreatePost}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <ShareModal
        post={sharingPost}
        isOpen={Boolean(sharingPost)}
        onClose={() => setSharingPost(null)}
        onShare={handleSharePost}
      />

      {/* Delete Post Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingPostId)}
        title="Delete Chronicle Post"
        message="Are you sure you want to permanently delete this post and its comments from the chronicle?"
        loading={isDeleting}
        onConfirm={handleConfirmDeletePost}
        onClose={() => setDeletingPostId(null)}
      />
    </main>
  );
}

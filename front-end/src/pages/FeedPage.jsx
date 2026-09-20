import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  getPublicFeedApi,
  getPostDetailApi,
  createPostApi,
  uploadPostMediaApi,
  votePostApi,
  deletePostApi,
  addCommentApi,
  deleteCommentApi,
  sharePostApi,
} from '../api/social';

import {
  PostComposer,
  PostCard,
  FeedFilter,
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
  };

  // 2. Vote Post (optimistic update, server-confirmed)
  const handleVotePost = async (postId, value) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, score: (p.score || 0) - (p.user_vote || 0) + value, user_vote: value }
          : p
      )
    );

    try {
      const res = await votePostApi(postId, value);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, score: res.score, user_vote: res.user_vote } : p
        )
      );
    } catch (err) {
      console.error('Failed to vote:', err);
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

    // Sort by tab — popular ranks by vote score (upvotes minus downvotes)
    if (activeTab === 'popular') {
      result.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.comment_count || 0) - (a.comment_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [posts, activeTab, searchQuery]);

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 md:py-10">
      {/* Title & Description */}
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-histo-dark mb-1.5 tracking-tight">
          Chronicle Forum
        </h1>
        <p className="font-body text-sm text-histo-ink/70">
          Explore historical inquiries, publish theories, and deliberate with scholars worldwide.
        </p>
      </div>

      {/* Post Composer */}
      <PostComposer onPostCreated={handleCreatePost} />

      {/* Filter Tabs & Search */}
      <FeedFilter
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

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
                onVote={handleVotePost}
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

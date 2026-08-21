import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getPublicFeedApi, createPostApi, addCommentApi, togglePostLikeApi } from '../api/social';

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await getPublicFeedApi();
      setPosts(data || []);
    } catch {
      // Fallback mock post if offline
      setPosts([
        {
          id: 'mock-1',
          content: 'Did you know that Saint Patrick was actually born in Roman Britain before being captured and brought to Ireland?',
          like_count: 5,
          comment_count: 2,
          created_at: new Date().toISOString(),
          author: { username: 'HistoryBuff', tag: '1234' },
          comments: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    try {
      const created = await createPostApi(newPostContent.trim());
      setPosts([created, ...posts]);
      setNewPostContent('');
    } catch {
      // Offline fallback push
      const fallbackPost = {
        id: `post-${Date.now()}`,
        content: newPostContent,
        like_count: 0,
        comment_count: 0,
        created_at: new Date().toISOString(),
        author: user ? { username: user.username, tag: user.tag } : { username: 'Scholar', tag: '0000' },
        comments: [],
      };
      setPosts([fallbackPost, ...posts]);
      setNewPostContent('');
    }
  };

  const handleLike = async (postId) => {
    try {
      const { new_like_count } = await togglePostLikeApi(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, like_count: new_like_count } : p));
    } catch {
      setPosts(posts.map(p => p.id === postId ? { ...p, like_count: p.like_count + 1 } : p));
    }
  };

  const handleAddComment = async (postId, parentCommentId = null) => {
    if (!replyContent.trim()) return;
    try {
      await addCommentApi(postId, replyContent.trim(), parentCommentId);
      setReplyContent('');
      setActiveReplyId(null);
      loadFeed();
    } catch {
      setReplyContent('');
      setActiveReplyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-histo-dark text-white border-b border-white/10 shadow-medium">
        <Link to="/" className="font-display text-2xl font-bold tracking-[4px] text-histo-paper uppercase">HISTOFACTS</Link>
        <nav className="flex gap-6">
          <Link to="/" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors">Home</Link>
          <Link to="/feed" className="text-xs font-ui tracking-wider uppercase text-histo-gold font-semibold">Community Feed</Link>
          <Link to="/quiz" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors">Quiz</Link>
        </nav>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-histo-dark mb-2">Chronicle Discussion Feed</h1>
        <p className="font-body text-sm text-histo-ink/70 mb-8">Share historical insights, debate theories, and reply to fellow scholars.</p>

        {/* Post Composer */}
        <form onSubmit={handleCreatePost} className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft mb-8">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder={user ? `What historical fact is on your mind, ${user.username}?` : "Log in to post historical insights..."}
            disabled={!user}
            className="w-full h-24 p-3 bg-histo-paper/40 border border-histo-dark/15 rounded-[2px] text-sm font-body outline-none focus:border-histo-copper resize-none"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs font-ui text-histo-ink/50">
              {user ? `Posting as ${user.username}#${user.tag}` : 'Log in to post'}
            </span>
            <button
              type="submit"
              disabled={!user || !newPostContent.trim()}
              className="border border-histo-copper bg-histo-copper text-white hover:bg-histo-dark px-6 py-2 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              Publish Post
            </button>
          </div>
        </form>

        {/* Posts Feed */}
        {loading ? (
          <div className="py-12 text-center text-sm font-body italic text-histo-ink/60">Loading chronicle posts...</div>
        ) : (
          <div className="flex flex-col gap-6">
            {posts.map((post) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-histo-dark/10 p-6 rounded-[4px] shadow-soft flex flex-col gap-4"
              >
                {/* Author row */}
                <div className="flex items-center justify-between border-b border-histo-dark/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-xs">
                      {(post.author?.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-ui text-xs font-bold text-histo-dark block">
                        {post.author ? `${post.author.username}#${post.author.tag}` : 'Anonymous Scholar'}
                      </span>
                      <span className="text-[10px] font-ui text-histo-ink/40">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <p className="font-body text-base text-histo-ink leading-relaxed whitespace-pre-wrap">{post.content}</p>

                {/* Actions */}
                <div className="flex items-center gap-6 pt-2 border-t border-histo-dark/10">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 text-xs font-ui font-medium text-histo-ink/70 hover:text-histo-copper transition-colors cursor-pointer"
                  >
                    <span>❤️</span>
                    <span>{post.like_count} Likes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveReplyId(activeReplyId === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-xs font-ui font-medium text-histo-ink/70 hover:text-histo-copper transition-colors cursor-pointer"
                  >
                    <span>💬</span>
                    <span>{post.comment_count} Comments</span>
                  </button>
                </div>

                {/* Reply Composer */}
                <AnimatePresence>
                  {activeReplyId === post.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2 pt-3 border-t border-histo-dark/10"
                    >
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-2 border border-histo-dark/15 rounded-[2px] text-xs font-ui outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          className="bg-histo-dark text-white px-4 py-2 text-xs font-ui font-semibold rounded-[2px] hover:bg-histo-gold hover:text-histo-dark transition-colors cursor-pointer"
                        >
                          Comment
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

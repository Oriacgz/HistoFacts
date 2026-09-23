import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Flame,
  Gamepad2,
  HelpCircle,
  Layers,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
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
import { useToast } from '../contexts/ToastContext';

import {
  PostComposer,
  PostCard,
  ShareModal,
  DeleteConfirmModal,
} from '../features/community';

// Sidebar component reusable for both desktop sticky column and mobile slide-over drawer
const FeedSidebarContent = memo(function FeedSidebarContent({
  activeTab,
  onTabChange,
  onOpenCreatePost,
  onTopicSelect,
  onCloseDrawer,
}) {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState({
    games: true,
    eras: true,
    communities: true,
    resources: false,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNav = (action) => {
    action();
    if (onCloseDrawer) onCloseDrawer();
  };

  return (
    <div className="space-y-4">
      {/* Primary Navigation */}
      <nav className="space-y-1" aria-label="Chronicle Views">
        <button
          type="button"
          onClick={() => handleNav(() => onTabChange('latest'))}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-ui font-semibold transition-all cursor-pointer ${
            activeTab === 'latest'
              ? 'bg-histo-paper text-histo-dark shadow-xs border border-histo-dark/10'
              : 'text-histo-ink/70 hover:bg-histo-paper/60 hover:text-histo-dark'
          }`}
        >
          <Clock3 className={`h-4 w-4 ${activeTab === 'latest' ? 'text-histo-copper' : ''}`} />
          Latest Discussions
        </button>

        <button
          type="button"
          onClick={() => handleNav(() => onTabChange('popular'))}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-ui font-semibold transition-all cursor-pointer ${
            activeTab === 'popular'
              ? 'bg-histo-paper text-histo-dark shadow-xs border border-histo-dark/10'
              : 'text-histo-ink/70 hover:bg-histo-paper/60 hover:text-histo-dark'
          }`}
        >
          <Flame className={`h-4 w-4 ${activeTab === 'popular' ? 'text-histo-copper' : ''}`} />
          Trending Topics
        </button>

        <button
          type="button"
          onClick={() => handleNav(() => navigate('/quiz'))}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-ui text-histo-ink/70 transition-all hover:bg-histo-paper/60 hover:text-histo-dark cursor-pointer"
        >
          <Gamepad2 className="h-4 w-4 text-histo-gold" />
          History Quizzes
        </button>

        <button
          type="button"
          onClick={() => handleNav(() => navigate('/groups'))}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-ui text-histo-ink/70 transition-all hover:bg-histo-paper/60 hover:text-histo-dark cursor-pointer"
        >
          <Users className="h-4 w-4 text-histo-copper" />
          Study Groups
        </button>

        <button
          type="button"
          onClick={() => handleNav(() => navigate('/notes'))}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-ui text-histo-ink/70 transition-all hover:bg-histo-paper/60 hover:text-histo-dark cursor-pointer"
        >
          <BookOpen className="h-4 w-4 text-histo-dark" />
          AI Study Notes
        </button>

        <button
          type="button"
          onClick={() => handleNav(onOpenCreatePost)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-histo-copper/10 px-3 py-2.5 text-xs font-ui font-semibold text-histo-copper border border-histo-copper/25 transition-all hover:bg-histo-copper hover:text-white cursor-pointer shadow-2xs"
        >
          <Plus className="h-4 w-4" /> Start a Discussion
        </button>
      </nav>

      {/* Historical Eras Quick Filters */}
      <div className="border-t border-histo-dark/10 pt-3">
        <button
          type="button"
          onClick={() => toggleSection('eras')}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-[10px] font-ui font-bold uppercase tracking-[0.14em] text-histo-ink/45 hover:text-histo-dark transition-colors"
        >
          <span>HISTORICAL ERAS</span>
          {openSections.eras ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {openSections.eras && (
          <div className="mt-1 space-y-0.5">
            {[
              { label: 'Ancient Civilizations', query: 'ancient' },
              { label: 'Medieval & Renaissance', query: 'renaissance' },
              { label: 'Enlightenment & Empires', query: 'empire' },
              { label: 'Modern & Global Wars', query: 'war' },
              { label: 'Curiosities & Mysteries', query: 'mystery' },
            ].map(({ label, query }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleNav(() => onTopicSelect(query))}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-xs font-ui text-histo-ink/65 transition-colors hover:bg-histo-paper hover:text-histo-dark cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5 text-histo-ink/40" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scholar Communities */}
      <div className="border-t border-histo-dark/10 pt-3">
        <button
          type="button"
          onClick={() => toggleSection('communities')}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-[10px] font-ui font-bold uppercase tracking-[0.14em] text-histo-ink/45 hover:text-histo-dark transition-colors"
        >
          <span>COMMUNITIES</span>
          {openSections.communities ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {openSections.communities && (
          <div className="mt-1 space-y-0.5">
            {[
              'Historiography Guild',
              'Archaeology Circle',
              'Military Chronicles',
              'Philosophy & Ideas',
            ].map((comm) => (
              <button
                key={comm}
                type="button"
                onClick={() => handleNav(() => onTopicSelect(comm.split(' ')[0].toLowerCase()))}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-xs font-ui text-histo-ink/65 transition-colors hover:bg-histo-paper hover:text-histo-dark cursor-pointer"
              >
                <Users className="h-3.5 w-3.5 text-histo-ink/40" />
                <span>{comm}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines & Resources */}
      <div className="border-t border-histo-dark/10 pt-3">
        <button
          type="button"
          onClick={() => toggleSection('resources')}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-[10px] font-ui font-bold uppercase tracking-[0.14em] text-histo-ink/45 hover:text-histo-dark transition-colors"
        >
          <span>SCHOLAR CODE</span>
          {openSections.resources ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {openSections.resources && (
          <div className="mt-1 space-y-1 px-3 py-1 text-xs font-ui text-histo-ink/60 leading-relaxed">
            <p className="flex items-center gap-2">
              <HelpCircle className="h-3.5 w-3.5 text-histo-copper shrink-0" />
              <span>Cite source materials when making historical claims.</span>
            </p>
            <p className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-histo-gold shrink-0" />
              <span>Maintain respectful and rigorous discourse.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default function FeedPage() {
  const toast = useToast();
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
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollTickRef = useRef(false);
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTickRef.current) return;
      scrollTickRef.current = true;
      requestAnimationFrame(() => {
        setShowScrollTop(window.scrollY > 400);
        scrollTickRef.current = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!showCreatePost && !showMobileDrawer) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowCreatePost(false);
        setShowMobileDrawer(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showCreatePost, showMobileDrawer]);

  const loadFeed = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchFeedOnMount = async () => {
      try {
        const data = await getPublicFeedApi({ limit: 50 });
        if (!ignore) {
          setPosts(data || []);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load feed:', err);
          setError('Unable to load chronicle discussions. Please check your connection and try again.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchFeedOnMount();

    return () => {
      ignore = true;
    };
  }, []);

  // 1. Create Post (then attach any staged media)
  const handleCreatePost = async ({ content, title, files }) => {
    try {
      const created = await createPostApi(content, { title });
      let final = created;
      if (files?.length) {
        try {
          const res = await uploadPostMediaApi(created.id, files);
          final = { ...created, media_urls: res.media_urls, media_type: res.media_type };
        } catch (err) {
          console.error('Failed to upload post media:', err);
          throw err;
        }
      }
      setPosts((prev) => [final, ...prev]);
      setShowCreatePost(false);
      toast.success('Your chronicle has been published to the forum!');
    } catch (err) {
      console.error('Failed to create post:', err);
      toast.error('Failed to publish chronicle. Please try again.');
    }
  };

  // 2. React to Post (optimistic update, server-confirmed)
  const handlePostReaction = useCallback(async (postId, reaction) => {
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
  }, [loadFeed]);

  // 3. Load Comments for a Post
  const handleLoadComments = useCallback(async (postId) => {
    try {
      const updatedPost = await getPostDetailApi(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
      );
    } catch (err) {
      console.error('Failed to load post comments:', err);
    }
  }, []);

  // 4. Add Comment / Reply
  const handleAddComment = useCallback(async (postId, content, parentCommentId = null, mediaUrl = null) => {
    await addCommentApi(postId, content, {
      parentCommentId,
      mediaUrl,
    });
    await handleLoadComments(postId);
  }, [handleLoadComments]);

  // 5. Delete Comment
  const handleDeleteComment = useCallback(async (postId, commentId) => {
    await deleteCommentApi(postId, commentId);
    const updatedPost = await getPostDetailApi(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updatedPost } : p))
    );
  }, []);

  // 6. Delete Post
  const handleConfirmDeletePost = async () => {
    if (!deletingPostId) return;
    setIsDeleting(true);
    try {
      await deletePostApi(deletingPostId);
      setPosts((prev) => prev.filter((p) => p.id !== deletingPostId));
      setDeletingPostId(null);
      toast.info('Chronicle removed from the forum.');
    } catch (err) {
      console.error('Failed to delete post:', err);
      toast.error('Failed to delete chronicle.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 7. Share Post
  const handleSharePost = useCallback(async (postId, { shareChannel, caption }) => {
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
  }, []);

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

    // Sort popular posts by net reaction score
    if (activeTab === 'popular') {
      result.sort((a, b) => ((b.likes || 0) - (b.dislikes || 0)) - ((a.likes || 0) - (a.dislikes || 0)) || (b.comment_count || 0) - (a.comment_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [posts, activeTab, searchQuery]);

  return (
    <main className="relative flex-1 bg-histo-paper/70 px-3 pb-16 pt-5 sm:px-5 lg:px-8">
      {/* Main Grid: Responsive 1-col on mobile/tablet, 2-col on lg (sidebar + feed), 3-col on xl (sidebar + feed + recent) */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,680px)_280px] xl:justify-center">
        {/* Left Desktop Sidebar (Hidden below lg, accessible via drawer on mobile/tablet) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-2xl border border-histo-dark/10 bg-white p-3.5 text-histo-ink shadow-soft">
            <div className="mb-3 px-3 py-1 flex items-center justify-between">
              <span className="text-[10px] font-ui font-bold uppercase tracking-[0.16em] text-histo-copper">
                DISCOVERY DESK
              </span>
              <Compass className="h-3.5 w-3.5 text-histo-copper" />
            </div>
            <FeedSidebarContent
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenCreatePost={() => setShowCreatePost(true)}
              onTopicSelect={(topic) => setSearchQuery(topic)}
            />
          </div>
        </aside>

        {/* Center Chronicle Feed Column */}
        <section className="min-w-0 w-full max-w-2xl mx-auto lg:max-w-none">
          {/* Feed Header */}
          <div className="mb-4 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="mb-0.5 text-[10px] font-ui font-bold uppercase tracking-[0.18em] text-histo-copper">
                COMMUNITY FORUM
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-histo-dark sm:text-3xl">
                Student Discussions
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1 rounded-full bg-histo-copper/10 px-2.5 py-1 text-[11px] font-ui font-medium text-histo-copper border border-histo-copper/20 hover:bg-histo-copper/20 transition-colors cursor-pointer"
                >
                  <span>Filtering: "{searchQuery}"</span>
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Mobile/Tablet Topics Drawer Trigger */}
              <button
                type="button"
                onClick={() => setShowMobileDrawer(true)}
                className="lg:hidden inline-flex h-9 items-center gap-1.5 rounded-xl border border-histo-dark/10 bg-white px-3 text-xs font-ui font-semibold text-histo-dark hover:bg-histo-paper transition-colors shadow-soft cursor-pointer"
                title="Explore Topics & Communities"
                aria-label="Open topics and communities sidebar"
              >
                <Layers className="h-4 w-4 text-histo-copper" />
                <span>Topics</span>
              </button>

              {/* Primary Create Post Action */}
              <button
                type="button"
                onClick={() => setShowCreatePost(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-histo-copper px-4 text-xs font-ui font-semibold text-white shadow-xs transition-colors hover:bg-histo-dark cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Create post</span>
              </button>
            </div>
          </div>

          {/* Feed Controls: Tabs & Search Bar */}
          <div
            role="toolbar"
            aria-label="Feed controls"
            className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-histo-dark/10 bg-white p-2.5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
          >
            {/* Tabs */}
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Feed tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'latest'}
                onClick={() => setActiveTab('latest')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-ui font-semibold transition-all cursor-pointer ${
                  activeTab === 'latest'
                    ? 'bg-histo-dark text-white shadow-xs'
                    : 'text-histo-ink/65 hover:bg-histo-paper hover:text-histo-dark'
                }`}
              >
                <Clock3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Latest</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'popular'}
                onClick={() => setActiveTab('popular')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-ui font-semibold transition-all cursor-pointer ${
                  activeTab === 'popular'
                    ? 'bg-histo-dark text-white shadow-xs'
                    : 'text-histo-ink/65 hover:bg-histo-paper hover:text-histo-dark'
                }`}
              >
                <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Trending</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-histo-ink/40" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discussions, thesis, scholars..."
                aria-label="Search the chronicle"
                className="h-9 w-full rounded-xl border border-histo-dark/10 bg-histo-paper/60 pl-9 pr-8 text-xs font-ui text-histo-dark outline-none transition-all placeholder:text-histo-ink/40 focus:border-histo-copper focus:bg-white focus:ring-2 focus:ring-histo-copper/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-histo-ink/40 hover:text-histo-dark transition-colors cursor-pointer"
                  aria-label="Clear search query"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Error Message when posts already exist (e.g. background refresh failure) */}
          {error && posts.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl font-ui flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadFeed}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {/* Posts Feed */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="relative overflow-hidden bg-white border border-histo-dark/10 rounded-2xl p-5 shadow-soft"
                >
                  {/* Subtle Parchment Shimmer Overlay */}
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-histo-paper/50 to-transparent pointer-events-none" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-histo-paper" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-histo-paper rounded w-1/4" />
                      <div className="h-3 bg-histo-paper rounded w-1/6" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-histo-paper rounded w-full" />
                    <div className="h-4 bg-histo-paper rounded w-4/5" />
                  </div>
                  <div className="h-8 bg-histo-paper/60 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : error && posts.length === 0 ? (
            /* Dedicated Error State when initial feed fails to load */
            <div className="py-14 text-center bg-white border border-red-200/80 rounded-2xl shadow-soft p-8">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3 shadow-2xs">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-histo-dark mb-1">
                Unable to Load Discussions
              </h3>
              <p className="font-body text-xs md:text-sm text-histo-ink/65 max-w-sm mx-auto mb-5">
                We could not connect to the discussion forum. Please check your internet connection or server status and try again.
              </p>
              <button
                type="button"
                onClick={loadFeed}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-histo-copper text-white rounded-xl text-xs font-ui font-semibold hover:bg-histo-dark transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            /* Genuine Empty State */
            <div className="py-16 text-center bg-white border border-histo-dark/10 rounded-2xl shadow-soft p-8">
              <div className="w-12 h-12 rounded-full bg-histo-paper text-histo-copper mx-auto flex items-center justify-center text-xl mb-3 shadow-2xs">
                📜
              </div>
              <h3 className="font-display font-bold text-lg text-histo-dark mb-1">
                No Discussions Found
              </h3>
              <p className="font-body text-xs md:text-sm text-histo-ink/60 max-w-sm mx-auto mb-4">
                {searchQuery
                  ? `No discussions match "${searchQuery}". Try a different topic or clear your filter.`
                  : 'Be the first to start a historical discussion!'}
              </p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-histo-dark text-white rounded-xl text-xs font-ui font-semibold hover:bg-histo-copper transition-colors cursor-pointer"
                >
                  Clear Search Filter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreatePost(true)}
                  className="px-4 py-2 bg-histo-copper text-white rounded-xl text-xs font-ui font-semibold hover:bg-histo-dark transition-colors cursor-pointer"
                >
                  Start a Discussion
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onReaction={handlePostReaction}
                    onAddComment={handleAddComment}
                    onDeleteComment={handleDeleteComment}
                    onDeletePost={setDeletingPostId}
                    onOpenShare={setSharingPost}
                    onLoadComments={handleLoadComments}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Right Sidebar: Recent Posts & Trending Eras (Visible on xl screens) */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {/* Recent Posts Card */}
            <div className="overflow-hidden rounded-2xl border border-histo-dark/10 bg-white shadow-soft">
              <div className="flex items-center justify-between border-b border-histo-dark/10 bg-histo-paper/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-histo-copper" />
                  <h2 className="text-[11px] font-ui font-bold uppercase tracking-[0.14em] text-histo-dark">
                    Recent discussions
                  </h2>
                </div>
                <div className="flex items-center gap-1.5" title="Live stream">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-ui font-semibold text-emerald-700">LIVE</span>
                </div>
              </div>

              <div className="divide-y divide-histo-dark/5">
                {posts.slice(0, 5).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`post-${post.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="group block w-full px-4 py-3 text-left transition-colors hover:bg-histo-paper/60 cursor-pointer"
                  >
                    <p className="line-clamp-2 text-xs font-body leading-relaxed text-histo-dark group-hover:text-histo-copper transition-colors">
                      {post.title || post.content}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-ui text-histo-ink/45">
                      <span>{post.author?.username || 'Scholar'}</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {post.comment_count || 0}
                      </span>
                    </div>
                  </button>
                ))}

                {!posts.length && (
                  <p className="px-4 py-6 text-center text-xs font-ui text-histo-ink/45">
                    Recent discussions will appear here.
                  </p>
                )}
              </div>
            </div>

            {/* Trending Eras & Themes Card */}
            <div className="rounded-2xl border border-histo-dark/10 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-histo-gold" />
                <h3 className="text-[11px] font-ui font-bold uppercase tracking-[0.14em] text-histo-dark">
                  Trending Eras
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '#AncientRome', query: 'rome' },
                  { tag: '#Alexandria', query: 'alexandria' },
                  { tag: '#Renaissance', query: 'renaissance' },
                  { tag: '#SilkRoad', query: 'silk' },
                  { tag: '#IndustrialAge', query: 'industrial' },
                  { tag: '#WorldWar', query: 'war' },
                ].map(({ tag, query }) => {
                  const isActive = searchQuery.toLowerCase() === query.toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setSearchQuery('');
                        } else {
                          setSearchQuery(query);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-ui transition-all cursor-pointer ${
                        isActive
                          ? 'bg-histo-copper text-white border border-histo-copper font-semibold shadow-xs'
                          : 'bg-histo-paper/80 text-histo-ink/75 border border-histo-dark/10 hover:border-histo-copper hover:text-histo-copper hover:bg-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scholar Charter Tip */}
            <div className="rounded-2xl border border-histo-dark/10 bg-histo-paper/50 p-4 text-xs font-body text-histo-ink/70 leading-relaxed italic shadow-2xs">
              "History is not merely what was, but how we understand our journey." Engage respectfully and cite sources whenever possible.
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile / Tablet Topics Drawer */}
      <AnimatePresence>
        {showMobileDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex bg-histo-dark/50 backdrop-blur-xs lg:hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowMobileDrawer(false);
            }}
            role="presentation"
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative h-full w-full max-w-xs bg-white p-5 shadow-deep overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Topics and community navigation"
            >
              <div className="mb-4 flex items-center justify-between border-b border-histo-dark/10 pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-histo-copper" />
                  <span className="font-display font-bold text-base text-histo-dark">
                    Discussion Topics
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileDrawer(false)}
                  className="rounded-full p-1.5 text-histo-ink/50 hover:bg-histo-paper hover:text-histo-dark transition-colors cursor-pointer"
                  aria-label="Close topics drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <FeedSidebarContent
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenCreatePost={() => {
                  setShowMobileDrawer(false);
                  setShowCreatePost(true);
                }}
                onTopicSelect={(topic) => setSearchQuery(topic)}
                onCloseDrawer={() => setShowMobileDrawer(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Post Modal - Themed to warm parchment & dark ink aesthetic */}
      <AnimatePresence>
        {showCreatePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-histo-dark/60 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-12"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowCreatePost(false);
            }}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Create a discussion post"
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
        title="Delete Discussion Post"
        message="Are you sure you want to permanently delete this post and its comments from the forum?"
        loading={isDeleting}
        onConfirm={handleConfirmDeletePost}
        onClose={() => setDeletingPostId(null)}
      />

      {/* Floating Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={scrollToTop}
            aria-label="Scroll back to top of feed"
            className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-histo-dark text-histo-paper shadow-deep border border-histo-copper/40 transition-colors hover:bg-histo-copper cursor-pointer"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}

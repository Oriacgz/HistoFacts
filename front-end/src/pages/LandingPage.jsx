import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Sparkles,
  Users,
  Trophy,
  ArrowRight,
  Clock,
  Search,
  Shield,
  Globe,
  Menu,
  X,
} from 'lucide-react';
import { ArrowRightIcon, ShieldIcon, SparklesIcon, BookOpenIcon } from '../components/MotionIcons';
import { useAuth } from '../contexts/AuthContext';

const featureData = [
  {
    icon: BookOpen,
    title: 'Daily Historical Events',
    description: 'Curated "On This Day" facts from Wikipedia & Wikimedia. Browse by date, search any topic, and bookmark your favorites.',
    highlight: '10,000+ events synced',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Study Notes',
    description: 'Generate exam-ready notes for any history topic tailored to your curriculum — NCERT, UPSC, AP World, and more.',
    highlight: 'Curriculum-specific output',
  },
  {
    icon: Trophy,
    title: 'Interactive Quizzes',
    description: 'Test your knowledge with topic-based quizzes. Track performance with detailed charts and time analytics.',
    highlight: 'Charts & progress tracking',
  },
  {
    icon: Users,
    title: 'Study Groups & Social Feed',
    description: 'Join or create study groups, share notes, discuss history on the community feed, and connect with fellow scholars.',
    highlight: 'Discord-style threads',
  },
];

const stats = [
  { value: '10K+', label: 'Historical Events' },
  { value: '50+', label: 'Curricula Supported' },
  { value: '100%', label: 'Free to Start' },
  { value: '∞', label: 'Knowledge to Explore' },
];

const testimonials = [
  {
    quote: '"HistoFacts transformed how I prepare for UPSC. The AI notes are spot-on for NCERT syllabus."',
    author: 'Priya Sharma',
    role: 'UPSC Aspirant',
  },
  {
    quote: '"Finally, a history app that feels like a scholarly journal, not a trivia game."',
    author: 'Dr. Marcus Chen',
    role: 'History Professor',
  },
  {
    quote: '"The daily events feed is my morning coffee ritual. I\'ve learned something new every day for 6 months."',
    author: 'James Rivera',
    role: 'Lifelong Learner',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleScroll = () => setScrolled(window.scrollY > 20);
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 },
    },
  }), [shouldReduceMotion]);

  const itemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.4 } : { type: 'spring', stiffness: 80, damping: 15 },
    },
  }), [shouldReduceMotion]);

  const statVariants = useMemo(() => ({
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      transition: shouldReduceMotion ? { duration: 0.3, delay: i * 0.05 } : { delay: 0.3 + i * 0.1, type: 'spring', stiffness: 100, damping: 12 },
    }),
  }), [shouldReduceMotion]);

  if (loading) {
    return (
      <div className="min-h-screen bg-histo-dark flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="h-12 w-12 border-4 border-histo-gold/30 border-t-histo-gold rounded-full"
        />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="relative min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture overflow-x-hidden">
      {/* Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-histo-paper/95 backdrop-blur-md border-b border-histo-dark/10 shadow-soft' : 'bg-transparent'}`}>
        <nav className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold tracking-[4px] text-histo-dark uppercase">HISTOFACTS</Link>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors">How It Works</a>
            <a href="#testimonials" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors">Scholars</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/loginpg" className="hidden sm:block text-sm font-ui font-semibold tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors">Sign In</Link>
            <Link
              to="/loginpg"
              className="px-5 py-2.5 rounded-[2px] border border-histo-copper bg-histo-copper text-white text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark hover:border-histo-dark transition-all duration-300 shadow-soft"
            >
              Get Started Free
              <ArrowRight className="inline-block ml-1.5 h-3.5 w-3.5" />
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg text-histo-ink/70 hover:text-histo-copper hover:bg-histo-dark/10 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-histo-paper/95 backdrop-blur-md border-b border-histo-dark/10 py-4 px-6"
          >
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#testimonials" className="text-sm font-ui tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Scholars</a>
              <Link to="/loginpg" className="text-sm font-ui font-semibold tracking-wider uppercase text-histo-ink/70 hover:text-histo-copper transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
              <Link
                to="/loginpg"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[2px] border border-histo-copper bg-histo-copper text-white text-xs font-ui font-bold uppercase tracking-wider hover:bg-histo-dark hover:border-histo-dark transition-all duration-300 shadow-soft"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started Free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-16">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-histo-gold/5 rounded-full blur-[150px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-histo-copper/5 rounded-full blur-[150px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-histo-dark/5 rounded-full blur-[200px]" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-[1200px] mx-auto w-full text-center"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-histo-gold/10 border border-histo-gold/20 mb-8">
            <span className="relative flex h-2 w-2">
              <motion.span
                className="absolute inset-0 h-full w-full rounded-full bg-histo-gold"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="relative h-full w-full rounded-full bg-histo-gold" />
            </span>
            <span className="text-xs font-ui font-semibold uppercase tracking-[2px] text-histo-copper">New: AI Curriculum Notes Generator</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-[4px] text-histo-dark leading-[1.05] mb-6"
          >
            Your Gateway to the{' '}
            <span className="relative">
              <span className="relative z-10">Chronicles</span>
              <motion.div
                className="absolute bottom-2 left-0 right-0 h-4 bg-histo-gold/30 -z-10"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 100, damping: 15 }}
              />
            </span>{' '}
            of Civilization
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="font-body text-lg sm:text-xl md:text-2xl text-histo-ink/60 max-w-[700px] mx-auto mb-10 leading-relaxed"
          >
            Daily historical facts, AI-powered study notes, interactive quizzes, and a community of scholars — all in one beautifully crafted chronicle.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link
              to="/loginpg"
              className="group relative px-8 py-4 rounded-[2px] bg-histo-dark text-histo-paper text-sm font-ui font-bold uppercase tracking-[2px] hover:bg-histo-gold hover:text-histo-dark transition-all duration-300 shadow-soft border border-histo-dark overflow-hidden"
            >
              <span className="relative z-10">Begin Your Journey</span>
              <motion.span
                className="absolute inset-0 bg-histo-gold origin-left"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
              <ArrowRightIcon className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-histo-paper group-hover:text-histo-dark transition-colors" />
            </Link>
            <a
              href="#features"
              className="px-8 py-4 rounded-[2px] border-2 border-histo-dark/20 text-histo-ink text-sm font-ui font-bold uppercase tracking-[2px] hover:border-histo-copper hover:bg-histo-copper/10 hover:text-histo-copper transition-all duration-300"
            >
              Explore Features
            </a>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-8 md:gap-12 text-sm font-ui text-histo-ink/40 uppercase tracking-wider"
          >
            <span className="flex items-center gap-2">
              <ShieldIcon className="h-4 w-4 text-histo-copper/60" />
              No Ads
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-histo-copper/60" />
              Open Data
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-histo-copper/60" />
              Daily Updates
            </span>
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-histo-copper/60" />
              Full Search
            </span>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-histo-ink/30"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-[9px] font-ui tracking-[3px] uppercase">Scroll to Explore</span>
          <motion.div className="h-6 w-1.5 border border-histo-ink/30 rounded-full overflow-hidden">
            <motion.div
              className="h-1.5 w-full bg-histo-copper"
              animate={{ y: [-10, 20] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 px-6 border-y border-histo-dark/10 bg-histo-cream/50">
        <div className="max-w-[1440px] mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
          >
            {stats.map((stat, i) => (
              <motion.div key={stat.label} variants={statVariants} custom={i} className="text-center">
                <div className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-histo-dark tracking-wide mb-2">{stat.value}</div>
                <div className="text-sm font-ui uppercase tracking-[2px] text-histo-ink/50">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-histo-paper">
        <div className="max-w-[1440px] mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.span variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-histo-gold/10 border border-histo-gold/20 text-xs font-ui uppercase tracking-[2px] text-histo-copper mb-4">
              <SparklesIcon className="h-3.5 w-3.5" />
              Core Features
            </motion.span>
            <motion.h2 variants={itemVariants} className="font-display text-4xl md:text-5xl font-bold text-histo-dark tracking-wide mb-4">Everything a Historian Needs</motion.h2>
            <motion.p variants={itemVariants} className="font-body text-lg text-histo-ink/60 max-w-[600px] mx-auto leading-relaxed">Designed for students, educators, and lifelong learners who want more than trivia.</motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {featureData.map((feature, i) => (
              <motion.article
                key={feature.title}
                variants={itemVariants}
                custom={i}
                whileHover={shouldReduceMotion ? {} : { y: -8, boxShadow: 'var(--shadow-deep)' }}
                className="group relative p-8 bg-white border border-histo-dark/10 rounded-[4px] shadow-soft transition-all duration-300 hover:border-histo-copper/30"
              >
                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-histo-gold/10 border border-histo-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex h-14 w-14 items-center justify-center rounded-[2px] bg-histo-dark text-histo-paper mb-6 group-hover:bg-histo-copper group-hover:text-white transition-colors duration-300">
                  <feature.icon className="h-7 w-7" />
                </div>
                
                <h3 className="font-display text-xl font-bold text-histo-dark mb-3">{feature.title}</h3>
                <p className="font-body text-sm text-histo-ink/70 leading-relaxed mb-4">{feature.description}</p>
                
                <div className="flex items-center gap-2 text-[10px] font-ui uppercase tracking-[2px] text-histo-copper font-semibold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-histo-copper" />
                  {feature.highlight}
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-histo-cream">
        <div className="max-w-[1440px] mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.span variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-histo-copper/10 border border-histo-copper/20 text-xs font-ui uppercase tracking-[2px] text-histo-copper mb-4">
              <BookOpenIcon className="h-3.5 w-3.5" />
              How It Works
            </motion.span>
            <motion.h2 variants={itemVariants} className="font-display text-4xl md:text-5xl font-bold text-histo-dark tracking-wide mb-4">Three Steps to Mastery</motion.h2>
            <motion.p variants={itemVariants} className="font-body text-lg text-histo-ink/60 max-w-[600px] mx-auto leading-relaxed">From curiosity to expertise in minutes a day.</motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
          >
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[60px] left-[16.66%] right-[16.66%] h-[2px] bg-gradient-to-r from-histo-copper/30 via-histo-gold/50 to-histo-copper/30 -z-10" />

            {[
              { step: '01', title: 'Discover', description: 'Start with today\'s historical events or search any topic. Bookmark what resonates.', icon: Search },
              { step: '02', title: 'Learn Deeply', description: 'Generate AI notes tailored to your curriculum. Take quizzes to test retention.', icon: BookOpen },
              { step: '03', title: 'Connect & Grow', description: 'Join study groups, share insights on the feed, track progress over time.', icon: Users },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                variants={itemVariants}
                custom={i}
                className="relative text-center md:text-left"
              >
                <div className="relative z-10 mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-histo-dark text-histo-paper font-display font-bold text-xl mb-4">{item.step}</div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[2px] bg-white border border-histo-dark/10 mx-auto md:mx-0 mb-4 shadow-soft">
                    <item.icon className="h-6 w-6 text-histo-dark" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-histo-dark mb-2">{item.title}</h3>
                  <p className="font-body text-sm text-histo-ink/60 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 bg-histo-paper">
        <div className="max-w-[1440px] mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="text-center mb-16"
          >
            <motion.span variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-histo-gold/10 border border-histo-gold/20 text-xs font-ui uppercase tracking-[2px] text-histo-copper mb-4">
              <Users className="h-3.5 w-3.5" />
              Trusted by Scholars
            </motion.span>
            <motion.h2 variants={itemVariants} className="font-display text-4xl md:text-5xl font-bold text-histo-dark tracking-wide mb-4">What Our Community Says</motion.h2>
            <motion.p variants={itemVariants} className="font-body text-lg text-histo-ink/60 max-w-[600px] mx-auto leading-relaxed">Real feedback from students, educators, and history enthusiasts.</motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {testimonials.map((testimonial, i) => (
              <motion.article
                key={testimonial.author}
                variants={itemVariants}
                custom={i}
                whileHover={shouldReduceMotion ? {} : { y: -4 }}
                className="p-8 bg-white border border-histo-dark/10 rounded-[4px] shadow-soft hover:border-histo-gold/30 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <motion.span
                      key={j}
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + j * 0.05, type: 'spring', stiffness: 200, damping: 15 }}
                      className="text-histo-gold"
                    >★</motion.span>
                  ))}
                </div>
                <blockquote className="font-body text-base text-histo-ink/80 leading-relaxed mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</blockquote>
                <div className="border-t border-histo-dark/10 pt-4">
                  <p className="font-display text-sm font-semibold text-histo-dark">{testimonial.author}</p>
                  <p className="font-ui text-xs text-histo-ink/50 uppercase tracking-wider">{testimonial.role}</p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-histo-dark">
        <div className="max-w-[800px] mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-histo-gold/10 border border-histo-gold/20 text-xs font-ui uppercase tracking-[2px] text-histo-gold mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ready to Begin?
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-histo-paper tracking-wide mb-6"
            >
              Start Your Historical Journey Today
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="font-body text-lg text-histo-paper/60 max-w-[500px] mx-auto mb-10 leading-relaxed"
            >
              Join thousands of scholars exploring the past. Free forever, no credit card required.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to="/loginpg"
                className="group relative px-8 py-4 rounded-[2px] bg-histo-gold text-histo-dark text-sm font-ui font-bold uppercase tracking-[2px] hover:bg-white hover:text-histo-dark transition-all duration-300 shadow-soft border border-histo-gold"
              >
                <span className="relative z-10">Create Free Account</span>
                <ArrowRightIcon className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-histo-dark group-hover:text-histo-ink transition-colors" />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 rounded-[2px] border-2 border-white/20 text-histo-paper text-sm font-ui font-bold uppercase tracking-[2px] hover:border-histo-gold hover:bg-histo-gold/10 hover:text-histo-gold transition-all duration-300"
              >
                Learn More
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-histo-dark/10 bg-histo-paper py-12 px-6">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <Link to="/" className="font-display text-2xl font-bold tracking-[4px] text-histo-dark uppercase block mb-4">HISTOFACTS</Link>
              <p className="font-body text-sm text-histo-ink/60 leading-relaxed max-w-xs">Your daily chronicle of civilization. Historical facts, AI study notes, quizzes, and community — all in one beautifully crafted platform.</p>
            </div>
            <div>
              <h4 className="font-ui text-xs font-semibold uppercase tracking-[2px] text-histo-ink mb-4">Product</h4>
              <ul className="space-y-2 text-sm font-body text-histo-ink/60">
                <li><a href="#features" className="hover:text-histo-copper transition-colors">Daily Events</a></li>
                <li><a href="#features" className="hover:text-histo-copper transition-colors">AI Notes</a></li>
                <li><a href="#features" className="hover:text-histo-copper transition-colors">Quizzes</a></li>
                <li><a href="#features" className="hover:text-histo-copper transition-colors">Study Groups</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-ui text-xs font-semibold uppercase tracking-[2px] text-histo-ink mb-4">Company</h4>
              <ul className="space-y-2 text-sm font-body text-histo-ink/60">
                <li><a href="#" className="hover:text-histo-copper transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-histo-copper transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-histo-copper transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-histo-copper transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-histo-dark/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body text-xs text-histo-ink/40">© 2024 HistoFacts. Built for scholars, by scholars.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-histo-ink/40 hover:text-histo-gold transition-colors" aria-label="Twitter">𝕏</a>
              <a href="#" className="text-histo-ink/40 hover:text-histo-gold transition-colors" aria-label="GitHub">⌘</a>
              <a href="#" className="text-histo-ink/40 hover:text-histo-gold transition-colors" aria-label="Discord">💬</a>
              <a href="#" className="text-histo-ink/40 hover:text-histo-gold transition-colors" aria-label="Email">✉️</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
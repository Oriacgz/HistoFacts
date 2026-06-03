import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GoogleIcon, FacebookIcon } from '../components/MotionIcons';

const historicalSnippets = [
  { year: '753 BC', event: 'Founding of Rome', detail: 'Romulus founds the city that would become the center of Western civilization.' },
  { year: '1215', event: 'Magna Carta', detail: 'King John seals the Great Charter at Runnymede, laying foundations for constitutional law.' },
  { year: '1492', event: 'Columbus Reaches America', detail: 'Three ships cross the Atlantic, forever altering the course of world history.' },
  { year: '1776', event: 'American Independence', detail: 'Thirteen colonies declare freedom, igniting the age of revolution worldwide.' },
  { year: '1969', event: 'Moon Landing', detail: 'Neil Armstrong takes one small step, fulfilling humanity\'s ancient dream of reaching the stars.' },
];

const todayQuote = {
  text: 'The only thing new in the world is the history you do not know.',
  author: 'Harry S. Truman',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin');
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('registeredUsers') || '[]');
    } catch {
      return [];
    }
  });
  const [signUpErrors, setSignUpErrors] = useState({});
  const [signInErrors, setSignInErrors] = useState({});

  const shouldReduceMotion = useReducedMotion();

  const customContainerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08, delayChildren: shouldReduceMotion ? 0 : 0.2 },
    },
  }), [shouldReduceMotion]);

  const customItemUp = useMemo(() => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: shouldReduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 120, damping: 14 } },
  }), [shouldReduceMotion]);

  const customSnippetVariants = useMemo(() => ({
    hidden: { opacity: 0, x: shouldReduceMotion ? 0 : -12 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: shouldReduceMotion ? { duration: 0.2 } : { delay: 0.4 + i * 0.1, type: 'spring', stiffness: 100, damping: 16 },
    }),
  }), [shouldReduceMotion]);

  const formItemVariants = useMemo(() => ({
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 150, damping: 15 }
    }
  }), [shouldReduceMotion]);

  const formStaggerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
      }
    }
  }), [shouldReduceMotion]);

  useEffect(() => {
    window.document.body.style.overflow = 'hidden';
    return () => { window.document.body.style.overflow = ''; };
  }, []);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (pw) => pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);

  const clearError = (setter, field) => setter((prev) => {
    const next = { ...prev };
    delete next[field];
    return next;
  });

  const handleSignUp = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = {};
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (name.length < 2) errs.name = 'Name must be at least 2 characters';
    if (!email) errs.email = 'Email is required';
    else if (!validateEmail(email)) errs.email = 'Please enter a valid email';
    else if (registeredUsers.some((u) => u.email === email)) errs.email = 'Email already registered';
    if (!password) errs.password = 'Password is required';
    else if (!validatePassword(password)) errs.password = 'Min 8 chars, 1 uppercase, 1 number';

    setSignUpErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const next = [...registeredUsers, { name, email, password }];
    setRegisteredUsers(next);
    window.localStorage.setItem('registeredUsers', JSON.stringify(next));
    window.alert('Registration successful! You can now sign in.');
    form.reset();
    setActiveTab('signin');
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = {};
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email) errs.email = 'Email is required';
    else if (!validateEmail(email)) errs.email = 'Please enter a valid email';
    if (!password) errs.password = 'Password is required';

    const user = registeredUsers.find((u) => u.email === email);
    if (Object.keys(errs).length === 0) {
      if (!user) errs.email = 'Email not found. Register first.';
      else if (user.password !== password) errs.password = 'Incorrect password';
    }

    setSignInErrors(errs);
    if (Object.keys(errs).length === 0) {
      window.alert('Login successful!');
      navigate('/');
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const renderSignIn = () => (
    <motion.div 
      variants={formStaggerVariants}
      initial="hidden"
      animate="visible"
      className="relative p-8 md:p-12 lg:p-16 h-full flex flex-col justify-center border-r-0 md:border-r border-histo-dark/10"
    >
      {/* Inner frame accent */}
      <div className="absolute top-3 left-3 right-3 bottom-3 border border-histo-dark/5 pointer-events-none rounded-[2px]" />

      <div className="relative z-10">
        <motion.div variants={formItemVariants} className="flex items-center gap-2 mb-1">
          <div className="h-1 w-1 rounded-full bg-histo-copper" />
          <span className="text-[10px] font-ui tracking-[3px] uppercase text-histo-copper font-semibold">Returning Scholar</span>
        </motion.div>
        <motion.h2 variants={formItemVariants} className="font-display text-3xl font-bold text-histo-dark tracking-wide mb-6">Sign In</motion.h2>

        <form onSubmit={handleSignIn} className="flex flex-col gap-1">
          <motion.div variants={formItemVariants}>
            <LedgerField name="email" type="email" placeholder="Email address" error={signInErrors.email} onChange={() => clearError(setSignInErrors, 'email')} />
          </motion.div>
          <motion.div variants={formItemVariants}>
            <LedgerField name="password" type="password" placeholder="Password" error={signInErrors.password} onChange={() => clearError(setSignInErrors, 'password')} />
          </motion.div>

          <motion.div variants={formItemVariants} className="flex justify-end mt-1 mb-4">
            <a href="#" className="text-xs font-ui font-semibold text-histo-copper hover:text-histo-dark border-b border-transparent hover:border-histo-dark pb-0.5 transition-colors duration-200">Forgot password?</a>
          </motion.div>

          <motion.button
            variants={formItemVariants}
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-[2px] border border-histo-dark bg-histo-dark py-3.5 text-xs font-bold font-ui uppercase tracking-[2px] text-histo-paper transition-colors duration-300 hover:bg-histo-gold hover:text-histo-dark hover:border-histo-gold shadow-soft cursor-pointer"
          >
            Sign In
          </motion.button>
        </form>

        <motion.div variants={formItemVariants} className="flex items-center gap-3 my-5">
          <div className="h-[1px] flex-1 bg-histo-dark/10" />
          <span className="text-[10px] font-ui tracking-[2px] uppercase text-histo-ink/40">or continue with</span>
          <div className="h-[1px] flex-1 bg-histo-dark/10" />
        </motion.div>

        <motion.div variants={formItemVariants} className="flex gap-3 justify-center">
          <SocialButton icon={GoogleIcon} label="Google" />
          <SocialButton icon={FacebookIcon} label="Facebook" />
        </motion.div>

        {/* Mobile toggle */}
        <motion.p variants={formItemVariants} className="text-center text-xs text-histo-ink/50 font-ui mt-6 md:hidden">
          New here?{' '}
          <button type="button" onClick={() => setActiveTab('signup')} className="text-histo-copper font-semibold hover:underline cursor-pointer">Create an account</button>
        </motion.p>
      </div>
    </motion.div>
  );

  const renderSignUp = () => (
    <motion.div 
      variants={formStaggerVariants}
      initial="hidden"
      animate="visible"
      className="relative p-8 md:p-12 lg:p-16 h-full flex flex-col justify-center bg-gradient-to-br from-histo-paper to-histo-cream"
    >
      {/* Inner frame accent */}
      <div className="absolute top-3 left-3 right-3 bottom-3 border border-histo-dark/5 pointer-events-none rounded-[2px]" />
      {/* Corner accents */}
      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-histo-gold/20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-histo-gold/20 pointer-events-none" />

      <div className="relative z-10">
        <motion.div variants={formItemVariants} className="flex items-center gap-2 mb-1">
          <div className="h-1 w-1 rounded-full bg-histo-gold" />
          <span className="text-[10px] font-ui tracking-[3px] uppercase text-histo-gold font-semibold">New Explorer</span>
        </motion.div>
        <motion.h2 variants={formItemVariants} className="font-display text-3xl font-bold text-histo-dark tracking-wide mb-6">Create Account</motion.h2>

        <form onSubmit={handleSignUp} className="flex flex-col gap-1">
          <motion.div variants={formItemVariants}>
            <LedgerField name="name" type="text" placeholder="Full name" error={signUpErrors.name} onChange={() => clearError(setSignUpErrors, 'name')} />
          </motion.div>
          <motion.div variants={formItemVariants}>
            <LedgerField name="email" type="email" placeholder="Email address" error={signUpErrors.email} onChange={() => clearError(setSignUpErrors, 'email')} />
          </motion.div>
          <motion.div variants={formItemVariants}>
            <LedgerField name="password" type="password" placeholder="Password" error={signUpErrors.password} onChange={() => clearError(setSignUpErrors, 'password')} />
          </motion.div>

          <motion.button
            variants={formItemVariants}
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full mt-4 rounded-[2px] border border-histo-copper bg-histo-copper py-3.5 text-xs font-bold font-ui uppercase tracking-[2px] text-white transition-colors duration-300 hover:bg-histo-dark hover:border-histo-dark shadow-soft cursor-pointer"
          >
            Create Account
          </motion.button>
        </form>

        <motion.div variants={formItemVariants} className="flex items-center gap-3 my-5">
          <div className="h-[1px] flex-1 bg-histo-dark/10" />
          <span className="text-[10px] font-ui tracking-[2px] uppercase text-histo-ink/40">or continue with</span>
          <div className="h-[1px] flex-1 bg-histo-dark/10" />
        </motion.div>

        <motion.div variants={formItemVariants} className="flex gap-3 justify-center">
          <SocialButton icon={GoogleIcon} label="Google" />
          <SocialButton icon={FacebookIcon} label="Facebook" />
        </motion.div>

        {/* Mobile toggle */}
        <motion.p variants={formItemVariants} className="text-center text-xs text-histo-ink/50 font-ui mt-6 md:hidden">
          Already have an account?{' '}
          <button type="button" onClick={() => setActiveTab('signin')} className="text-histo-copper font-semibold hover:underline cursor-pointer">Sign in</button>
        </motion.p>
      </div>
    </motion.div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#121c25]">
      {/* Subtle background grain */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-[#0d1720] via-[#162534] to-[#1c3144]" />
      <div className="pointer-events-none fixed inset-0 -z-[5] opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />

      {/* Header */}
      <header className="fixed left-0 top-0 z-20 flex w-full items-center justify-between bg-histo-dark/90 px-8 py-4 border-b border-white/10 backdrop-blur-md">
        <Link to="/" className="font-display text-2xl font-bold tracking-[4px] text-histo-paper uppercase">HISTOFACTS</Link>
        <nav className="flex gap-6">
          <Link to="/" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors duration-200">Home</Link>
          <a href="#" className="text-xs font-ui tracking-wider uppercase text-histo-paper/85 hover:text-histo-gold transition-colors duration-200">About</a>
        </nav>
      </header>

      {/* Main editorial spread */}
      <main className="flex min-h-screen items-center justify-center px-4 pt-24 pb-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={customContainerVariants}
          className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8"
        >
          {/* Newspaper Masthead */}
          <motion.div variants={customItemUp} className="text-center mb-6">
            <div className="flex items-center justify-center gap-4 mb-2">
              <div className="h-[1px] flex-1 max-w-[120px] bg-histo-gold/40" />
              <span className="text-[10px] font-ui tracking-[5px] uppercase text-histo-gold/80">Est. Since the Dawn of Time</span>
              <div className="h-[1px] flex-1 max-w-[120px] bg-histo-gold/40" />
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold tracking-[6px] text-histo-paper uppercase leading-none">HISTOFACTS</h1>
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="h-[2px] flex-1 max-w-[80px] bg-histo-gold/60" />
              <span className="text-[10px] font-ui tracking-[3px] uppercase text-histo-paper/50">{currentDate}</span>
              <div className="h-[2px] flex-1 max-w-[80px] bg-histo-gold/60" />
            </div>
            <div className="h-[1px] w-full max-w-[700px] mx-auto mt-4 bg-white/10" />
          </motion.div>

          {/* Main Content: Ledger Book Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-white/10 rounded-[4px] overflow-hidden shadow-deep">

            {/* Left Archive Column */}
            <motion.aside
              variants={customItemUp}
              className="lg:col-span-4 bg-histo-dark border-r border-white/10 p-8 hidden lg:flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-histo-gold" />
                  <span className="text-[10px] font-ui tracking-[3px] uppercase text-histo-gold font-semibold">Today&apos;s Archive</span>
                </div>

                <div className="flex flex-col gap-4">
                  {historicalSnippets.map((s, i) => (
                    <motion.div
                      key={s.year}
                      custom={i}
                      variants={customSnippetVariants}
                      initial="hidden"
                      animate="visible"
                      className="group cursor-pointer"
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-display text-sm font-bold text-histo-gold">{s.year}</span>
                        <div className="h-[1px] flex-1 bg-white/10 group-hover:bg-histo-gold/30 transition-colors duration-300" />
                      </div>
                      <h4 className="font-display text-sm font-semibold text-histo-paper/90 mb-1 group-hover:text-histo-gold transition-colors duration-200">{s.event}</h4>
                      <p className="font-body text-xs text-histo-paper/50 leading-relaxed">{s.detail}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Daily Quote */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="font-display text-sm italic text-histo-paper/70 leading-relaxed">&ldquo;{todayQuote.text}&rdquo;</p>
                <span className="text-[10px] font-ui tracking-widest uppercase text-histo-gold/70 mt-2 block">— {todayQuote.author}</span>
              </div>
            </motion.aside>

            {/* Center: Double-Sided Ledger (Sign In / Sign Up) */}
            <div className="lg:col-span-8 bg-histo-paper histo-paper-texture">
              {/* Desktop layout: side by side */}
              <div className="hidden md:grid md:grid-cols-2 h-full">
                {renderSignIn()}
                {renderSignUp()}
              </div>

              {/* Mobile layout: tab switcher */}
              <div className="md:hidden relative min-h-[580px]">
                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === 'signin' ? (
                    <motion.div
                      key="signin"
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 50 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                      className="w-full h-full"
                    >
                      {renderSignIn()}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signup"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                      className="w-full h-full"
                    >
                      {renderSignUp()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Bottom ticker */}
          <motion.div variants={customItemUp} className="mt-4 flex items-center justify-center gap-3">
            <div className="h-[1px] flex-1 max-w-[60px] bg-white/10" />
            <span className="text-[9px] font-ui tracking-[3px] uppercase text-histo-paper/30">Your gateway to the chronicles of civilization</span>
            <div className="h-[1px] flex-1 max-w-[60px] bg-white/10" />
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}

function LedgerField({ error, onChange, ...props }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <div className="w-full relative py-2">
      <input
        {...props}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full border-b-2 bg-transparent px-1 py-3 text-sm outline-none transition-all duration-200 text-histo-dark placeholder:text-histo-dark/35 font-ui ${error ? 'border-histo-danger' : 'border-histo-dark/15'}`}
      />
      {/* Animated focus underline */}
      {!error && (
        <motion.div
          className="absolute bottom-2 left-0 right-0 h-[2px] bg-histo-copper origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isFocused ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      )}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-left text-xs font-ui font-medium text-histo-danger mt-1"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialButton({ icon: Icon, label }) {
  return (
    <motion.a
      href="#"
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 rounded-[2px] border border-histo-dark/15 px-5 py-2.5 text-histo-dark hover:border-histo-copper hover:text-histo-copper transition-colors duration-300 shadow-soft cursor-pointer"
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-ui font-semibold tracking-wide">{label}</span>
    </motion.a>
  );
}

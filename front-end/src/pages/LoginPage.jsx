import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FacebookIcon, GoogleIcon } from '../components/MotionIcons';

function createParticles(count) {
  return Array.from({ length: count }, (_, index) => {
    const size = 1 + Math.random() * 7;

    return {
      id: `${index}-${Math.random().toString(36).slice(2, 8)}`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size,
      opacity: 0.2 + Math.random() * 0.6,
      duration: 3 + Math.random() * 7,
      delay: Math.random() * 3,
      pulse: Math.random() > 0.7,
    };
  });
}

function buildBlobs() {
  return [
    { color: '#34495e', size: 700, posX: 20, posY: 30, duration: 26 },
    { color: '#2c3e50', size: 600, posX: 70, posY: 60, duration: 23 },
    { color: '#283747', size: 800, posX: 30, posY: 70, duration: 28 },
    { color: '#1c2833', size: 750, posX: 80, posY: 20, duration: 25 },
    { color: '#1a2530', size: 650, posX: 10, posY: 80, duration: 24 },
  ];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('registeredUsers') || '[]');
    } catch {
      return [];
    }
  });
  const [signUpErrors, setSignUpErrors] = useState({});
  const [signInErrors, setSignInErrors] = useState({});
  const particles = useMemo(() => createParticles(48), []);
  const blobs = useMemo(() => buildBlobs(), []);

  useEffect(() => {
    window.document.body.style.overflow = 'hidden';

    return () => {
      window.document.body.style.overflow = '';
    };
  }, []);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const clearError = (setter, field) => setter((current) => {
    const next = { ...current };
    delete next[field];
    return next;
  });

  const handleSignUp = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nextErrors = {};
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (name.length < 2) {
      nextErrors.name = 'Name must be at least 2 characters';
    }

    if (!email) {
      nextErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      nextErrors.email = 'Please enter a valid email address';
    } else if (registeredUsers.some((user) => user.email === email)) {
      nextErrors.email = 'This email is already registered';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      nextErrors.password = 'Password must be at least 8 characters with 1 number and 1 uppercase letter';
    }

    setSignUpErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const nextUsers = [...registeredUsers, { name, email, password }];
    setRegisteredUsers(nextUsers);
    window.localStorage.setItem('registeredUsers', JSON.stringify(nextUsers));
    window.alert('Registration successful! You can now login.');
    form.reset();
    setActive(false);
  };

  const handleSignIn = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nextErrors = {};
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email) {
      nextErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      nextErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    }

    const user = registeredUsers.find((entry) => entry.email === email);

    if (Object.keys(nextErrors).length === 0) {
      if (!user) {
        nextErrors.email = 'Email not found. Please register first.';
      } else if (user.password !== password) {
        nextErrors.password = 'Incorrect password';
      }
    }

    setSignInErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      window.alert('Login successful!');
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-histo-sky font-ui text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-histo-navy to-histo-slate" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40">
        {blobs.map((blob, index) => (
          <div
            key={`${blob.color}-${index}`}
            className="absolute rounded-full blur-[80px]"
            style={{
              width: blob.size,
              height: blob.size,
              left: `${blob.posX}%`,
              top: `${blob.posY}%`,
              transform: 'translate(-50%, -50%)',
              background: blob.color,
              animation: `float ${blob.duration}s infinite alternate ease-in-out`,
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none fixed inset-0 -z-[5]">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className={`absolute rounded-full bg-white/70 ${particle.pulse ? 'animate-pulse' : ''}`}
            style={{
              left: particle.left,
              top: particle.top,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      <header className="fixed left-0 top-0 z-20 flex w-full items-center justify-between bg-[rgba(44,62,80,0.35)] px-[clamp(24px,6vw,100px)] py-5 backdrop-blur-[5vh]">
        <Link to="/" className="text-[32px] font-bold text-white">HISTOFACTS</Link>
        <nav className="flex gap-16 text-[18px] font-medium text-white">
          <a href="#about" className="relative after:absolute after:left-0 after:top-full after:h-[5px] after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">About</a>
          <a href="#help" className="relative after:absolute after:left-0 after:top-full after:h-[5px] after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">Help</a>
        </nav>
      </header>

      <main className="flex min-h-screen items-center justify-center px-4 pb-10 pt-28">
        <div className={`relative mx-auto min-h-[580px] w-full max-w-[868px] overflow-hidden rounded-[30px] bg-white shadow-[0_5px_15px_rgba(0,0,0,0.35)] ${active ? 'active' : ''}`}>
          <div className={`absolute left-0 top-0 h-full w-1/2 transition-all duration-500 ease-in-out ${active ? 'translate-x-full' : ''}`}>
            <form onSubmit={handleSignUp} className="flex h-full flex-col items-center justify-center bg-white px-10 text-histo-slate">
              <h1 className="text-4xl font-bold">Create Account</h1>
              <div className="my-5 flex gap-3">
                <a href="#" className="inline-flex h-10 w-10 items-center justify-center rounded-[20%] border border-[#ccc] text-histo-slate"><GoogleIcon className="h-4 w-4" /></a>
                <a href="#" className="inline-flex h-10 w-10 items-center justify-center rounded-[20%] border border-[#ccc] text-histo-slate"><FacebookIcon className="h-4 w-4" /></a>
              </div>
              <span className="text-base">or use your email for registeration</span>
              <Field name="name" type="text" placeholder="Name" error={signUpErrors.name} onChange={() => clearError(setSignUpErrors, 'name')} />
              <Field name="email" type="email" placeholder="Email" error={signUpErrors.email} onChange={() => clearError(setSignUpErrors, 'email')} />
              <Field name="password" type="password" placeholder="Password" error={signUpErrors.password} onChange={() => clearError(setSignUpErrors, 'password')} />
              <button type="submit" className="mt-3 rounded-lg border border-transparent bg-histo-slate px-11 py-2.5 text-base font-semibold uppercase tracking-[0.5px] text-white transition duration-300 hover:bg-[#243240]">Sign Up</button>
            </form>
          </div>

          <div className={`absolute left-0 top-0 h-full w-1/2 transition-all duration-500 ease-in-out ${active ? 'translate-x-full' : ''}`}>
            <form onSubmit={handleSignIn} className="flex h-full flex-col items-center justify-center bg-white px-10 text-histo-slate">
              <h1 className="text-4xl font-bold">Sign In</h1>
              <div className="my-5 flex gap-3">
                <a href="#" className="inline-flex h-10 w-10 items-center justify-center rounded-[20%] border border-[#ccc] text-histo-slate"><GoogleIcon className="h-4 w-4" /></a>
                <a href="#" className="inline-flex h-10 w-10 items-center justify-center rounded-[20%] border border-[#ccc] text-histo-slate"><FacebookIcon className="h-4 w-4" /></a>
              </div>
              <span className="text-base">or use your email password</span>
              <Field name="email" type="email" placeholder="Email" error={signInErrors.email} onChange={() => clearError(setSignInErrors, 'email')} />
              <Field name="password" type="password" placeholder="Password" error={signInErrors.password} onChange={() => clearError(setSignInErrors, 'password')} />
              <a href="#" className="my-4 text-[17px] text-histo-slate">Forget Your Password?</a>
              <button type="submit" className="mt-3 rounded-lg border border-transparent bg-histo-slate px-11 py-2.5 text-base font-semibold uppercase tracking-[0.5px] text-white transition duration-300 hover:bg-[#243240]">Sign In</button>
            </form>
          </div>

          <div className={`absolute left-1/2 top-0 z-10 h-full w-1/2 overflow-hidden transition-all duration-500 ease-in-out ${active ? 'translate-x-[-100%] rounded-[0_150px_100px_0]' : 'rounded-[150px_0_0_100px]'}`}>
            <div className={`relative left-[-100%] h-full w-[200%] bg-gradient-to-r from-[#385067] to-histo-slate text-white transition-all duration-500 ease-in-out ${active ? 'translate-x-1/2' : ''}`}>
              <div className={`absolute top-0 flex h-full w-1/2 flex-col items-center justify-center px-[30px] text-center transition-all duration-500 ease-in-out ${active ? 'translate-x-0' : '-translate-x-[200%]'}`}>
                <h1 className="text-4xl font-bold">Welcome Back!</h1>
                <p className="my-5 text-[18px] leading-5">Enter your personal details to use all of site features</p>
                <button type="button" onClick={() => setActive(false)} className="mt-3 rounded-lg border border-white bg-transparent px-11 py-2.5 text-base font-semibold uppercase tracking-[0.5px] text-white transition duration-300 hover:bg-white hover:text-histo-slate">Sign In</button>
              </div>
              <div className={`absolute right-0 top-0 flex h-full w-1/2 flex-col items-center justify-center px-[30px] text-center transition-all duration-500 ease-in-out ${active ? 'translate-x-[200%]' : 'translate-x-0'}`}>
                <h1 className="text-4xl font-bold">Hello, Friend!</h1>
                <p className="my-5 text-[18px] leading-5">Register with your personal details to use all of site features</p>
                <button type="button" onClick={() => setActive(true)} className="mt-3 rounded-lg border border-white bg-transparent px-11 py-2.5 text-base font-semibold uppercase tracking-[0.5px] text-white transition duration-300 hover:bg-white hover:text-histo-slate">Sign Up</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ error, onChange, ...props }) {
  return (
    <div className="w-full">
      <input
        {...props}
        onChange={onChange}
        className={`my-2 w-full rounded-lg border bg-[#eee] px-4 py-2.5 text-[13px] outline-none ${error ? 'border-[#ff3333] border-2' : 'border-transparent'}`}
      />
      {error ? <div className="-mt-1 mb-2 w-full text-left text-xs text-[#ff3333]">{error}</div> : null}
    </div>
  );
}

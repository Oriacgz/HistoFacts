import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  BookOpenIcon,
  BookmarkIcon,
  CalendarIcon,
  CogIcon,
  CrownIcon,
  FilterIcon,
  HeartIcon,
  BulbIcon,
  SearchIcon,
  TimeIcon,
  UserIcon,
} from '../components/MotionIcons';

const sidebarItems = [
  { to: '/quiz', icon: BulbIcon, label: 'Quiz' },
  { to: '#', icon: HeartIcon, label: 'Favorites' },
  { to: '#', icon: BookmarkIcon, label: 'Bookmarks' },
  { to: '#', icon: CogIcon, label: 'Settings' },
];

const headerIcons = [
  { icon: FilterIcon, label: 'Filters' },
  { icon: BellIcon, label: 'Notifications' },
  { icon: CalendarIcon, label: 'Historical Calendar' },
];

const newsSeed = [{ title: 'On This Day', content: 'Historical events that happened on this day will appear here.' }];

export default function DashboardPage() {
  const [newsItems, setNewsItems] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setNewsItems(newsSeed), 1500);
    const handleScroll = () => setScrolled(window.scrollY > 10);

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col items-center bg-gradient-to-b from-histo-dark to-[#142231] py-6 text-white shadow-[4px_0_10px_rgba(0,0,0,0.1)]">
        <Link to="/loginpg" className="mb-6 rounded-full bg-histo-light p-4 shadow-[0_4px_8px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:bg-histo-gold hover:text-histo-dark">
          <UserIcon className="h-8 w-8" />
        </Link>
        <div className="mb-6 h-0.5 w-10 bg-white/20" />
        <div className="flex flex-col items-center gap-6">
          {sidebarItems.map(({ to, icon: Icon, label }) => (
            <Link key={label} to={to} className="group relative flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition duration-300 hover:-translate-y-1 hover:rounded-2xl hover:bg-histo-gold hover:text-histo-dark">
              <Icon className="h-6 w-6 transition duration-300 group-hover:scale-110" />
              <span className="pointer-events-none absolute left-[66px] z-10 whitespace-nowrap rounded-md bg-histo-dark px-3 py-2 text-sm font-medium text-white opacity-0 shadow-[0_4px_8px_rgba(0,0,0,0.2)] transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">{label}</span>
            </Link>
          ))}
        </div>
      </aside>

      <div className="ml-20 flex min-h-screen flex-col">
        <header className={`sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 px-7 py-4 text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)] transition-colors duration-300 ${scrolled ? 'bg-histo-dark/95' : 'bg-gradient-to-r from-histo-dark to-histo-medium'}`}>
          <h1 className="font-display text-[36px] font-bold tracking-[1px] text-histo-paper drop-shadow-[2px_2px_4px_rgba(0,0,0,0.2)]">HISTOFACTS</h1>

          <nav className="flex gap-6">
            <Link to="/home" className="relative px-3 py-1.5 text-[18px] font-medium text-histo-paper transition duration-300 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-histo-gold after:transition-all after:duration-300 hover:text-histo-gold hover:after:w-full">Home</Link>
            <a href="#about" className="relative px-3 py-1.5 text-[18px] font-medium text-histo-paper transition duration-300 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-histo-gold after:transition-all after:duration-300 hover:text-histo-gold hover:after:w-full">About</a>
            <a href="#help" className="relative px-3 py-1.5 text-[18px] font-medium text-histo-paper transition duration-300 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-histo-gold after:transition-all after:duration-300 hover:text-histo-gold hover:after:w-full">Help</a>
          </nav>

          <div className="flex w-full max-w-[280px] items-center rounded-[24px] border border-white/10 bg-white/15 px-[18px] py-[10px] shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition duration-300 focus-within:-translate-y-0.5 focus-within:bg-white/25 focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.15)] md:w-auto">
            <input type="text" placeholder="Search historical facts..." className="w-full bg-transparent text-[16px] text-histo-paper outline-none placeholder:text-white/70" />
            <SearchIcon className="ml-2 h-5 w-5 text-histo-paper" />
          </div>

          <div className="flex gap-[18px]">
            {headerIcons.map(({ icon: Icon, label }) => (
              <div key={label} className="group relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 transition duration-300 hover:-translate-y-1 hover:bg-histo-gold">
                <Icon className="h-6 w-6 text-histo-paper transition duration-300 group-hover:text-histo-dark" />
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 translate-y-[-10px] whitespace-nowrap rounded-md bg-histo-dark px-3 py-2 text-sm font-medium text-white opacity-0 shadow-[0_4px_8px_rgba(0,0,0,0.2)] transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">{label}</span>
              </div>
            ))}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-7 overflow-y-auto p-7">
          <section className="relative overflow-hidden rounded-histo bg-gradient-to-br from-histo-medium to-histo-dark p-9 text-histo-paper shadow-medium transition duration-300 hover:-translate-y-1 hover:shadow-deep">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
            <div className="relative z-10 text-center">
              <h2 className="mb-7 font-display text-5xl font-bold tracking-[1px] text-histo-paper drop-shadow-[2px_2px_4px_rgba(0,0,0,0.2)]">HISTOFACTS</h2>
              <div className="mb-7 rounded-histo border border-white/10 bg-black/20 p-7 animate-pulseRing">
                <p className="text-[28px] font-bold leading-[1.4] tracking-[1px]">Today in History: March 17, 461 AD - Death of Saint Patrick</p>
              </div>
              <a href="#" className="inline-block rounded-[30px] bg-histo-gold px-[30px] py-3 text-[16px] font-semibold tracking-[0.5px] text-histo-dark shadow-[0_4px_8px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:bg-histo-paper hover:shadow-[0_8px_16px_rgba(0,0,0,0.3)]">Explore Historical Significance</a>
            </div>
          </section>

          <section className="rounded-histo border-l-[6px] border-histo-medium bg-histo-cream p-7 shadow-medium transition duration-300 hover:-translate-y-1 hover:shadow-deep">
            <div className="mb-5 flex items-center gap-[18px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/50 text-histo-dark shadow-soft">
                <TimeIcon className="h-8 w-8" />
              </div>
              <h3 className="font-display text-[28px] font-semibold text-histo-dark">Historical Events</h3>
            </div>
            <div className="min-h-[120px]">
              {newsItems.length === 0 ? (
                <div className="rounded-[8px] bg-histo-paper px-4 py-4 shadow-soft">Loading today&apos;s historical news...</div>
              ) : (
                newsItems.map((item) => (
                  <article key={item.title} className="mb-4 rounded-[8px] bg-histo-paper p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-medium">
                    <h4 className="mb-2 font-display text-xl text-histo-dark">{item.title}</h4>
                    <p className="leading-6">{item.content}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-histo bg-histo-cream p-7 shadow-medium transition duration-300 hover:-translate-y-1 hover:shadow-deep">
            <div className="mb-5 flex items-center gap-[18px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/50 text-histo-dark shadow-soft">
                  <BookOpenIcon className="h-8 w-8" />
              </div>
              <h3 className="font-display text-[28px] font-semibold text-histo-dark">Featured Historical Period</h3>
            </div>
            <div className="rounded-histo bg-gradient-to-br from-[#f8f3ea] to-histo-cream p-6 shadow-medium">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-histo-copper text-white shadow-soft">
                  <CrownIcon className="h-10 w-10" />
                </div>
                <h4 className="font-display text-2xl text-histo-dark">Renaissance Era</h4>
                <p className="max-w-xl">Explore the cultural bridge between the Middle Ages and modern history</p>
                <a href="#" className="font-semibold text-histo-dark underline-offset-4 transition hover:text-histo-copper hover:underline">Discover More</a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
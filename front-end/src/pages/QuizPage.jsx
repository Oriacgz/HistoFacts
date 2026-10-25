import QuizHub from '../features/quiz/QuizHub';

export default function QuizPage() {
  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
      {/* Quiz Page Heading */}
      <div className="mb-8 pb-4 border-b border-histo-dark/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-ui font-bold uppercase tracking-widest text-histo-copper bg-histo-copper/10 px-2.5 py-0.5 rounded-[2px]">
            Interactive Quizzes
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-histo-dark tracking-wide">
          Choose a Quiz Mode
        </h1>
        <p className="font-body text-xs sm:text-sm text-histo-ink/70 mt-1">
          Practice with custom AI quizzes, host a live multiplayer game with friends, or climb the monthly ranked leaderboard.
        </p>
      </div>

      {/* ── Quiz Hub with Big Game Mode Cards ── */}
      <QuizHub />
    </main>
  );
}
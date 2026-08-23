import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  UsersIcon,
  CrownIcon,
  TrophyIcon,
  CheckCircleIcon,
  RightArrowIcon,
  SparklesIcon,
  LogoutIcon,
} from '../../../components/MotionIcons';
import { createLobbyApi } from '../../../api/quiz';
import { useLobbySocket } from './useLobbySocket';
import QuestionCard from '../components/QuestionCard';
import Countdown from '../components/Countdown';
import MiniLeaderboard from '../components/MiniLeaderboard';

export default function HostLobby({ user, onExit }) {
  const [createdRoom, setCreatedRoom] = useState(null);
  const [topic, setTopic] = useState('World History Trivia');
  const [difficulty, setDifficulty] = useState('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const socket = useLobbySocket({
    code: createdRoom?.code,
    user,
    role: 'host',
  });

  const handleCreateRoom = async (e) => {
    e?.preventDefault();
    setIsCreating(true);
    try {
      const room = await createLobbyApi({
        topic: topic.trim() || 'World History Trivia',
        difficulty,
        count: 10,
      });
      setCreatedRoom(room);
    } catch (err) {
      console.warn('Lobby creation fallback:', err);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setCreatedRoom({
        code,
        host_name: user?.username || 'Host',
        topic: topic || 'World History',
        total_questions: 10,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const inviteUrl = createdRoom ? `${window.location.origin}/quiz?tab=lobby&join=${createdRoom.code}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Initial Host Setup Screen
  if (!createdRoom) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-histo-copper/10 border border-histo-copper/20 text-histo-copper text-xs font-ui font-semibold uppercase tracking-wider mb-3">
            <CrownIcon className="h-3.5 w-3.5" /> Host Synchronous Room
          </div>
          <h2 className="text-3xl font-display font-bold text-histo-dark mb-2">
            Host a Live Quiz Lobby
          </h2>
          <p className="text-sm font-body text-histo-ink/70">
            Create a real-time multiplayer room with live scoreboards, countdown timers, and QR code joining.
          </p>
        </div>

        <div className="rounded-histo bg-histo-cream border border-histo-dark/10 p-6 sm:p-8 shadow-medium">
          <form onSubmit={handleCreateRoom} className="space-y-6">
            <div>
              <label className="block text-xs font-ui font-bold text-histo-dark uppercase tracking-wider mb-2">
                Lobby Topic or Quiz Theme
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Ancient Civilizations, Medieval India, Modern Revolutions..."
                className="w-full rounded-[4px] border border-histo-dark/20 bg-white px-4 py-3.5 text-sm text-histo-dark outline-none placeholder:text-histo-ink/40 focus:border-histo-gold shadow-xs font-body transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-ui font-bold text-histo-dark uppercase tracking-wider mb-2">
                Difficulty Preset
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['easy', 'medium', 'hard'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`py-3 rounded-[3px] border text-xs font-ui font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      difficulty === lvl
                        ? 'border-2 border-histo-gold bg-white text-histo-dark shadow-soft ring-1 ring-histo-gold/30'
                        : 'border-histo-dark/15 bg-white/70 text-histo-ink/70 hover:bg-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-4 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold tracking-widest uppercase shadow-medium transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Preparing Lobby...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  <span>Create Lobby Room</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Host Waiting Room View
  if (socket.roomState === 'waiting_room') {
    const participantCount = socket.participants.length;

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-ui font-semibold text-histo-dark">
              Host Panel • {socket.topic}
            </span>
          </div>

          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <LogoutIcon className="h-3.5 w-3.5" /> End Room
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Join Code & QR Card */}
          <div className="lg:col-span-6 rounded-histo bg-histo-cream border border-histo-dark/10 p-6 sm:p-8 shadow-medium flex flex-col items-center text-center">
            <span className="text-xs font-ui font-bold uppercase tracking-widest text-histo-copper mb-2">
              Lobby Room Code
            </span>
            
            {/* 6-digit Code */}
            <div className="text-5xl sm:text-6xl font-display font-bold tracking-[0.2em] text-histo-dark py-2">
              {createdRoom.code}
            </div>

            {/* QR Code */}
            <div className="my-6 p-4 rounded-xl bg-white border border-histo-dark/15 shadow-soft">
              <QRCodeSVG
                value={inviteUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#1c3144"
                level="Q"
              />
            </div>

            <p className="text-xs font-body text-histo-ink/60 mb-4 italic">
              Scan with mobile camera or enter 6-digit code on the Join tab
            </p>

            {/* Share link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:border-histo-gold hover:bg-histo-paper transition-all shadow-soft flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 text-emerald-700" />
                  <span className="text-emerald-700 font-bold">Invite Link Copied!</span>
                </>
              ) : (
                <span>Copy Direct Invite Link</span>
              )}
            </button>
          </div>

          {/* Connected Participants List */}
          <div className="lg:col-span-6 rounded-histo bg-histo-cream border border-histo-dark/10 p-6 sm:p-8 shadow-medium flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-histo-dark/10">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-histo-copper" />
                  <h3 className="font-display text-lg font-bold text-histo-dark">
                    Joined Scholars ({participantCount})
                  </h3>
                </div>
                <span className="text-xs font-ui text-histo-ink/50">
                  Min. 1 required
                </span>
              </div>

              {/* Participant Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {participantCount === 0 ? (
                  <div className="col-span-2 py-12 text-center text-histo-ink/50 text-xs font-body italic">
                    <div className="h-8 w-8 border-2 border-histo-dark/20 border-t-histo-copper rounded-full animate-spin mx-auto mb-3" />
                    Waiting for scholars to join with code <span className="font-display font-bold text-histo-dark">{createdRoom.code}</span>...
                  </div>
                ) : (
                  socket.participants.map((p, idx) => (
                    <motion.div
                      key={p.user_id || idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2 p-2.5 rounded-histo bg-white border border-histo-dark/10 shadow-2xs"
                    >
                      <div className="h-7 w-7 rounded-full bg-histo-dark text-histo-paper font-display font-bold text-xs flex items-center justify-center">
                        {p.username?.[0]?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-ui font-semibold text-histo-dark truncate">{p.username}</p>
                        <p className="text-[10px] text-histo-ink/40 font-mono">#{p.tag}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Start Quiz CTA */}
            <div className="pt-6 border-t border-histo-dark/10">
              <button
                type="button"
                onClick={socket.startQuiz}
                disabled={participantCount === 0}
                className="w-full py-4 rounded-[4px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-ui font-bold uppercase tracking-widest shadow-medium transition-all flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Start Quiz ({participantCount} Players)</span>
                <RightArrowIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Host Active Play View
  if (socket.roomState === 'question_active') {
    const answeredCount = socket.participants.filter((p) => p.answered_current).length;
    const totalPlayers = socket.participants.length;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-ui font-bold uppercase text-histo-copper tracking-wider block mb-1">
              Host View • Question {socket.currentQuestionIndex + 1} of {socket.totalQuestions}
            </span>
            <h2 className="text-lg font-display font-bold text-histo-dark">{socket.topic}</h2>
          </div>

          <div className="flex items-center gap-3">
            <Countdown
              seconds={socket.timeRemaining}
              serverAuthoritative
              size="md"
            />

            <button
              type="button"
              onClick={socket.showMiniLeaderboard}
              className="px-4 py-2 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-wider shadow-soft transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Show Standings</span>
              <RightArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Question Display Card */}
        {socket.currentQuestion && (
          <QuestionCard
            index={socket.currentQuestionIndex}
            total={socket.totalQuestions}
            question={socket.currentQuestion.question}
            options={socket.currentQuestion.options}
            correctAnswer={socket.currentQuestion.correct_answer}
            showCorrectAnswer
            disabled
          />
        )}

        {/* Live Answer Progress Tracker */}
        <div className="mt-6 rounded-histo bg-histo-cream border border-histo-dark/10 p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-ui font-bold text-histo-dark uppercase tracking-wider">
              Live Player Responses
            </span>
            <span className="text-xs font-ui font-bold text-histo-copper">
              {answeredCount} / {totalPlayers} Answered
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-histo-dark/10 overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-histo-copper transition-all duration-300"
              style={{ width: `${totalPlayers > 0 ? (answeredCount / totalPlayers) * 100 : 0}%` }}
            />
          </div>

          {/* Active Player Pills */}
          <div className="flex flex-wrap gap-2">
            {socket.participants.map((p) => (
              <span
                key={p.user_id}
                className={`px-3 py-1 rounded-full text-xs font-ui flex items-center gap-1.5 border shadow-2xs transition-all ${
                  p.answered_current
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                    : 'bg-white/80 border-histo-dark/10 text-histo-ink/60'
                }`}
              >
                {p.answered_current && <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-700" />}
                <span>{p.username}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. Host Mini-Leaderboard View
  if (socket.roomState === 'mini_leaderboard') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <span className="text-xs font-ui font-bold uppercase tracking-wider text-histo-copper mb-1 block">
            End of Question {socket.currentQuestionIndex + 1}
          </span>
          <h2 className="text-2xl font-display font-bold text-histo-dark">Live Leaderboard Standings</h2>
        </div>

        <MiniLeaderboard
          participants={socket.participants}
          title="Round Standings"
          className="mb-6 shadow-medium"
        />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={socket.nextQuestion}
            className="px-8 py-3.5 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-widest shadow-medium transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>
              {socket.currentQuestionIndex + 1 >= socket.totalQuestions
                ? 'View Final Results'
                : 'Next Question'}
            </span>
            <RightArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 5. Host Final Results View
  if (socket.roomState === 'final_results') {
    const sortedLeaderboard = socket.finalLeaderboard.length > 0 
      ? socket.finalLeaderboard 
      : [...socket.participants].sort((a, b) => b.score - a.score);

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 rounded-histo bg-blue-50 border border-blue-200 p-4 text-xs font-ui text-blue-900 shadow-soft">
          <strong className="text-blue-950 font-bold block mb-1">Lobby Match Completed:</strong>
          Multiplayer lobby scores are for group study and live practice — they do not affect monthly Global Ranked ratings or Histoin balances.
        </div>

        <div className="rounded-histo bg-histo-cream border-2 border-histo-dark/15 p-8 shadow-deep text-center mb-6">
          <TrophyIcon className="h-16 w-16 text-histo-copper mx-auto mb-4" />
          <h2 className="text-3xl font-display font-bold text-histo-dark mb-2">
            Final Match Champions
          </h2>
          <p className="text-xs font-ui text-histo-ink/60 mb-8">{socket.topic} • {socket.totalQuestions} Questions</p>

          <div className="space-y-3 mb-8">
            {sortedLeaderboard.map((p, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={p.user_id || idx}
                  className={`flex items-center justify-between p-4 rounded-histo border transition-all ${
                    rank === 1
                      ? 'bg-amber-100 border-2 border-amber-500 text-amber-950 shadow-soft'
                      : rank === 2
                      ? 'bg-slate-100 border border-slate-300 text-slate-900'
                      : rank === 3
                      ? 'bg-amber-900/10 border border-amber-700/30 text-amber-950'
                      : 'bg-white border border-histo-dark/10 text-histo-ink'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-base w-6 text-left text-histo-copper">
                      #{rank}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-ui font-bold text-histo-dark">{p.username}</p>
                      <p className="text-[10px] text-histo-ink/50 font-mono">#{p.tag}</p>
                    </div>
                  </div>

                  <span className="text-base font-display font-bold text-histo-copper">
                    {p.score} pts
                  </span>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onExit}
            className="px-6 py-3 rounded-[4px] bg-white border border-histo-dark/20 text-xs font-ui font-bold uppercase tracking-wider text-histo-dark hover:bg-histo-paper shadow-soft transition-all cursor-pointer"
          >
            Return to Quiz Hub
          </button>
        </div>
      </div>
    );
  }

  return null;
}
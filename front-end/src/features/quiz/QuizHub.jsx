import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  UsersIcon,
  TrophyIcon,
  ClockIcon,
  CrownIcon,
  RightArrowIcon,
  BookOpenIcon,
  ChevronLeftIcon,
} from '../../components/MotionIcons';
import { useAuth } from '../../contexts/AuthContext';

// Mode Components
import CreatePersonalizedQuiz from './personalized/CreatePersonalizedQuiz';
import PersonalizedQuizPlay from './personalized/PersonalizedQuizPlay';
import HostLobby from './lobby/HostLobby';
import JoinLobby from './lobby/JoinLobby';
import LobbyWaitingRoom from './lobby/LobbyWaitingRoom';
import LobbyPlay from './lobby/LobbyPlay';
import { useLobbySocket } from './lobby/useLobbySocket';
import GlobalQuizEntry from './global/GlobalQuizEntry';
import GlobalLeaderboard from './global/GlobalLeaderboard';
import QuizHistoryList from './history/QuizHistoryList';

const GAME_MODES = [
  {
    id: 'personalized',
    title: 'Personalized Quiz',
    badge: 'AI & PDF Notes',
    badgeColor: 'bg-histo-copper/15 text-histo-copper border-histo-copper/30',
    icon: SparklesIcon,
    iconBg: 'bg-histo-copper/10 text-histo-copper border-histo-copper/30',
    subtitle: 'Adaptive Practice & Study Sheets',
    description: 'Generate 10 structured multiple-choice questions on any historical era, or upload your class notes / PDF study sheets for instant exam revision with immediate learning feedback.',
    highlights: ['10 Questions', 'Self-Paced', 'Instant Answer Feedback', 'Difficulty Scoring (+2 / -3)'],
    actionText: 'Launch Practice Mode',
  },
  {
    id: 'lobby',
    title: 'Group Lobby',
    badge: 'Live Kahoot Multiplayer',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: UsersIcon,
    iconBg: 'bg-blue-50 text-blue-800 border-blue-200',
    subtitle: 'Synchronous Classroom & Study Groups',
    description: 'Host or join real-time multiplayer trivia matches. Share a 6-digit room code or camera-scannable QR code with friends and compete for live podium streaks with synchronized server timers.',
    highlights: ['Server Timer', 'Host & Player Views', '6-Digit Code & QR Scanner', 'Live Standings'],
    actionText: 'Launch Lobby Mode',
  },
  {
    id: 'global',
    title: 'Global Ranked Championship',
    badge: '+20 🪙 Histoins Reward',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: TrophyIcon,
    iconBg: 'bg-amber-50 text-amber-800 border-amber-300',
    subtitle: 'Official 40-Question Monthly Championship',
    description: 'Test comprehensive world history chronology with competitive negative marking. Earn Histoins for correct answers and climb the global monthly scholar ladder.',
    highlights: ['40 Questions', 'Strict +2 / -2 Penalty', 'Monthly Seasonal Reset', 'Global Leaderboard'],
    actionText: 'Launch Ranked Mode',
  },
  {
    id: 'history',
    title: 'Quiz History & Reviews',
    badge: 'Study Archive',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: ClockIcon,
    iconBg: 'bg-purple-50 text-purple-800 border-purple-200',
    subtitle: 'Past Sessions & Granular Reviews',
    description: 'Review your complete historical test log, score accuracy, and inspect granular per-question logs showing what was answered vs. correct to double as an effective study tool.',
    highlights: ['Complete Attempt Log', 'Per-Question Review', 'Accuracy Tracking', 'Mode Badges'],
    actionText: 'Open History Archive',
  },
];

export default function QuizHub() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = searchParams.get('tab') || null;
  const [activeMode, setActiveMode] = useState(initialMode);

  // Personalized State
  const [activePersonalizedQuiz, setActivePersonalizedQuiz] = useState(null);

  // Lobby Sub-mode State: 'hub' | 'host' | 'join' | 'joined_play'
  const [lobbySubMode, setLobbySubMode] = useState('hub');
  const [lobbyJoinCode, setLobbyJoinCode] = useState(searchParams.get('join') || '');

  // Global Sub-mode State: 'entry' | 'leaderboard'
  const [globalSubMode, setGlobalSubMode] = useState('entry');

  // Player Lobby Socket Hook
  const playerSocket = useLobbySocket({
    code: lobbyJoinCode,
    user,
    role: 'player',
  });

  useEffect(() => {
    const joinCode = searchParams.get('join');
    if (joinCode) {
      setActiveMode('lobby');
      setLobbyJoinCode(joinCode);
      setLobbySubMode('joined_play');
    }
  }, [searchParams]);

  const handleSelectMode = (modeId) => {
    setActiveMode(modeId);
    setSearchParams({ tab: modeId });
    if (modeId === 'personalized') setActivePersonalizedQuiz(null);
    if (modeId === 'lobby' && lobbySubMode !== 'joined_play') setLobbySubMode('hub');
    if (modeId === 'global') setGlobalSubMode('entry');
  };

  const handleBackToModes = () => {
    setActiveMode(null);
    setSearchParams({});
    setActivePersonalizedQuiz(null);
    setLobbySubMode('hub');
  };

  const handleJoinLobbyCode = (code) => {
    setLobbyJoinCode(code);
    setLobbySubMode('joined_play');
  };

  return (
    <div className="w-full">
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 1. GAME MODES SELECTION (WIDE HORIZONTAL RECTANGULAR CARDS)          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {!activeMode && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="w-full space-y-5 mb-12"
        >
          {GAME_MODES.map((mode) => {
            const Icon = mode.icon;

            return (
              <motion.div
                key={mode.id}
                whileHover={{ y: -3, scale: 1.004 }}
                whileTap={{ scale: 0.996 }}
                onClick={() => handleSelectMode(mode.id)}
                className="group relative rounded-[4px] bg-white border border-histo-dark/15 hover:border-histo-copper p-5 sm:p-7 shadow-soft hover:shadow-medium transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                {/* Left: Icon & Badge */}
                <div className="flex items-start gap-4 shrink-0">
                  <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full border ${mode.iconBg} flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0`}>
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                  </div>
                </div>

                {/* Middle: Content Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-ui font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] border ${mode.badgeColor}`}>
                      {mode.badge}
                    </span>
                    <span className="text-[11px] font-ui font-semibold text-histo-copper uppercase tracking-wider">
                      • {mode.subtitle}
                    </span>
                  </div>

                  <h3 className="font-display text-xl sm:text-2xl font-bold text-histo-dark mb-2 group-hover:text-histo-copper transition-colors">
                    {mode.title}
                  </h3>

                  <p className="font-body text-xs sm:text-sm text-histo-ink/75 leading-relaxed mb-3 max-w-3xl">
                    {mode.description}
                  </p>

                  {/* Highlights Pills */}
                  <div className="flex flex-wrap gap-2">
                    {mode.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-ui font-medium px-2 py-0.5 rounded-[2px] bg-histo-paper border border-histo-dark/10 text-histo-dark"
                      >
                        ✓ {h}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Action Button */}
                <div className="w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-histo-dark/10 flex md:flex-col items-center justify-between gap-2">
                  <div className="px-5 py-3 rounded-[3px] bg-histo-copper group-hover:bg-histo-dark text-white font-ui text-xs font-bold uppercase tracking-wider shadow-soft transition-colors flex items-center gap-2 w-full md:w-auto justify-center">
                    <span>{mode.actionText}</span>
                    <RightArrowIcon className="h-4 w-4" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* 2. MODE ACTIVE VIEW (WITH PROMINENT BACK BUTTON & NO MINI NAVBAR)     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeMode && (
        <div className="w-full">
          {/* Prominent Back to Game Modes Button */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-histo-dark/15">
            <button
              type="button"
              onClick={handleBackToModes}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-histo-dark text-white hover:bg-histo-copper border border-histo-gold/40 shadow-soft transition-all font-ui text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-98"
            >
              <ChevronLeftIcon className="h-4 w-4 text-histo-gold group-hover:text-white transition-colors" />
              <span>← Back to All Game Modes</span>
            </button>

            {/* Current Active Mode Title Indicator */}
            <div className="text-right">
              <span className="text-[10px] font-ui font-bold uppercase tracking-widest text-histo-copper block">
                Active Assessment
              </span>
              <span className="font-display font-bold text-base text-histo-dark">
                {GAME_MODES.find((m) => m.id === activeMode)?.title}
              </span>
            </div>
          </div>

          {/* Mode Active Content */}
          <AnimatePresence mode="wait">
            {/* 1. PERSONALIZED */}
            {activeMode === 'personalized' && (
              <motion.div
                key="active-personalized"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {!activePersonalizedQuiz ? (
                  <CreatePersonalizedQuiz
                    onQuizReady={(quizPayload) => setActivePersonalizedQuiz(quizPayload)}
                  />
                ) : (
                  <PersonalizedQuizPlay
                    quiz={activePersonalizedQuiz}
                    onReset={() => {
                      setActivePersonalizedQuiz({ ...activePersonalizedQuiz });
                    }}
                    onTryHarder={() => {
                      const nextDiff = activePersonalizedQuiz.difficulty === 'easy' ? 'medium' : 'hard';
                      setActivePersonalizedQuiz({
                        ...activePersonalizedQuiz,
                        difficulty: nextDiff,
                      });
                    }}
                    onBackToHub={handleBackToModes}
                  />
                )}
              </motion.div>
            )}

            {/* 2. GROUP LOBBY */}
            {activeMode === 'lobby' && (
              <motion.div
                key="active-lobby"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {lobbySubMode === 'hub' && (
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-6 pb-3 border-b border-histo-dark/10">
                      <h2 className="font-display text-2xl font-bold text-histo-dark">
                        Synchronous Group Lobbies
                      </h2>
                      <p className="font-body text-xs text-histo-ink/70 mt-0.5">
                        Host a classroom trivia match with a shared screen code, or join your study group.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Host Match */}
                      <div
                        onClick={() => setLobbySubMode('host')}
                        className="p-6 rounded-[4px] bg-white hover:bg-histo-cream/50 border border-histo-dark/15 hover:border-histo-copper shadow-soft transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-12 w-12 rounded-full bg-histo-copper/10 text-histo-copper flex items-center justify-center mb-4 shadow-xs">
                            <CrownIcon className="h-6 w-6" />
                          </div>
                          <h3 className="font-display text-xl font-bold text-histo-dark mb-2">
                            Host a Match
                          </h3>
                          <p className="font-body text-xs text-histo-ink/70 leading-relaxed mb-6">
                            Display a 6-digit room code & camera QR code, control round advancement, and broadcast live podiums.
                          </p>
                        </div>

                        <span className="text-xs font-ui font-bold uppercase tracking-wider text-histo-copper flex items-center gap-1">
                          Configure & Host <RightArrowIcon className="h-4 w-4" />
                        </span>
                      </div>

                      {/* Join Match */}
                      <div
                        onClick={() => setLobbySubMode('join')}
                        className="p-6 rounded-[4px] bg-white hover:bg-histo-cream/50 border border-histo-dark/15 hover:border-histo-copper shadow-soft transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="h-12 w-12 rounded-full bg-histo-dark text-histo-paper flex items-center justify-center mb-4 shadow-xs">
                            <BookOpenIcon className="h-6 w-6" />
                          </div>
                          <h3 className="font-display text-xl font-bold text-histo-dark mb-2">
                            Join Existing Match
                          </h3>
                          <p className="font-body text-xs text-histo-ink/70 leading-relaxed mb-6">
                            Enter your host's 6-digit code, paste an invite link, or scan their screen QR code with your camera.
                          </p>
                        </div>

                        <span className="text-xs font-ui font-bold uppercase tracking-wider text-histo-dark flex items-center gap-1">
                          Enter Room Code <RightArrowIcon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {lobbySubMode === 'host' && (
                  <HostLobby
                    user={user}
                    onExit={() => setLobbySubMode('hub')}
                  />
                )}

                {lobbySubMode === 'join' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setLobbySubMode('hub')}
                      className="mb-4 text-xs font-ui font-bold uppercase tracking-wider text-histo-ink/60 hover:text-histo-dark flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to Lobby Options
                    </button>
                    <JoinLobby
                      onJoinCode={handleJoinLobbyCode}
                      initialCode={lobbyJoinCode}
                    />
                  </div>
                )}

                {lobbySubMode === 'joined_play' && (
                  <div>
                    {playerSocket.roomState === 'waiting_room' ? (
                      <LobbyWaitingRoom
                        code={lobbyJoinCode}
                        hostName={playerSocket.hostName}
                        topic={playerSocket.topic}
                        participants={playerSocket.participants}
                        user={user}
                        isConnected={playerSocket.isConnected}
                        isReconnecting={playerSocket.isReconnecting}
                        onLeave={() => setLobbySubMode('hub')}
                      />
                    ) : (
                      <LobbyPlay
                        socket={playerSocket}
                        user={user}
                        onExit={() => setLobbySubMode('hub')}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. GLOBAL RANKED */}
            {activeMode === 'global' && (
              <motion.div
                key="active-global"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {globalSubMode === 'entry' ? (
                  <GlobalQuizEntry
                    user={user}
                    onBackToHub={handleBackToModes}
                    onOpenLeaderboard={() => setGlobalSubMode('leaderboard')}
                  />
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setGlobalSubMode('entry')}
                      className="mb-4 text-xs font-ui font-bold uppercase tracking-wider text-histo-ink/60 hover:text-histo-dark flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to Challenge Info
                    </button>
                    <GlobalLeaderboard
                      user={user}
                      onTakeQuiz={() => setGlobalSubMode('entry')}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* 4. HISTORY */}
            {activeMode === 'history' && (
              <motion.div
                key="active-history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <QuizHistoryList
                  onStartPersonalized={() => handleSelectMode('personalized')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
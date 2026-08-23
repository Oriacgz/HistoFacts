import React from 'react';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  CrownIcon,
  SparklesIcon,
  LogoutIcon,
} from '../../../components/MotionIcons';

export default function LobbyWaitingRoom({
  code,
  hostName = 'Host',
  topic = 'History Trivia',
  participants = [],
  user,
  isConnected = true,
  isReconnecting = false,
  onLeave,
}) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-ui font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" /> Connected
            </span>
          ) : isReconnecting ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-ui font-semibold animate-pulse">
              Reconnecting to match...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-900 text-xs font-ui font-semibold">
              Offline
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="px-3 py-1.5 rounded-[4px] border border-histo-dark/20 bg-white text-xs font-ui font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <LogoutIcon className="h-3.5 w-3.5" /> Leave Lobby
        </button>
      </div>

      {/* Main Card */}
      <div className="rounded-histo bg-histo-cream border border-histo-dark/10 p-8 shadow-medium text-center">
        {/* Room Code Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-histo-dark text-histo-paper text-xs font-display font-bold mb-4 shadow-soft">
          Room #{code}
        </div>

        <h2 className="text-2xl sm:text-3xl font-display font-bold text-histo-dark mb-2">
          {topic}
        </h2>
        <p className="text-xs sm:text-sm font-ui text-histo-ink/70 mb-8 flex items-center justify-center gap-1.5">
          <CrownIcon className="h-4 w-4 text-histo-copper" />
          Hosted by <strong className="text-histo-dark">{hostName}</strong>
        </p>

        {/* Animated Radar Indicator */}
        <div className="relative my-8 flex items-center justify-center">
          <div className="h-20 w-20 rounded-full bg-white border-2 border-histo-gold flex items-center justify-center text-histo-copper shadow-soft">
            <SparklesIcon className="h-8 w-8 text-histo-copper" />
          </div>
          <div className="absolute h-28 w-28 rounded-full border border-histo-copper/30 animate-ping pointer-events-none" />
        </div>

        <h3 className="text-lg font-display font-bold text-histo-dark mb-1">
          You're in the waiting room!
        </h3>
        <p className="text-xs font-body text-histo-ink/60 mb-8 italic">
          The quiz will begin as soon as the host hits Start. Keep this screen active.
        </p>

        {/* Connected Peers List */}
        <div className="border-t border-histo-dark/10 pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-ui font-bold uppercase tracking-wider text-histo-dark flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 text-histo-copper" />
              Scholars in Lobby ({participants.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 max-h-48 overflow-y-auto">
            {participants.map((p, idx) => {
              const isMe = p.username === user?.username;
              return (
                <motion.div
                  key={p.user_id || idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`px-3 py-1.5 rounded-histo border text-xs font-ui flex items-center gap-2 shadow-2xs ${
                    isMe
                      ? 'bg-white border-2 border-histo-gold text-histo-dark font-bold'
                      : 'bg-white/70 border-histo-dark/10 text-histo-ink'
                  }`}
                >
                  <div className="h-5 w-5 rounded-full bg-histo-dark text-histo-paper flex items-center justify-center text-[10px] font-display font-bold">
                    {p.username?.[0]?.toUpperCase()}
                  </div>
                  <span>{p.username}</span>
                  {isMe && <span className="text-[9px] text-histo-copper uppercase font-bold">(You)</span>}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

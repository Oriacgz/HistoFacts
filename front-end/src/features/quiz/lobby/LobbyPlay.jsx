import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon, CheckCircleIcon } from '../../../components/MotionIcons';
import QuestionCard from '../components/QuestionCard';
import Countdown from '../components/Countdown';
import MiniLeaderboard from '../components/MiniLeaderboard';
import ResultsSummary from '../components/ResultsSummary';

export default function LobbyPlay({ socket, user, onExit }) {
  const {
    roomState,
    topic,
    currentQuestionIndex,
    totalQuestions,
    currentQuestion,
    timeRemaining,
    participants,
    miniLeaderboard,
    finalLeaderboard,
    myAnswerResult,
    hasAnsweredCurrent,
    submitAnswer,
    isReconnecting,
  } = socket;

  const currentParticipant = participants.find((p) => p.username === user?.username) || {};

  // 1. Question Active View
  if (roomState === 'question_active') {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Silent Reconnect Banner */}
        {isReconnecting && (
          <div className="mb-4 rounded-histo bg-amber-50 border border-amber-300 p-2.5 flex items-center justify-between text-xs font-ui text-amber-900 animate-pulse">
            <span className="font-semibold">Reconnecting to match...</span>
            <span>Question synced</span>
          </div>
        )}

        {/* Top Progress & Live Countdown */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-ui font-bold uppercase text-histo-copper tracking-wider block mb-1">
              Match in Progress • Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <h2 className="text-base sm:text-lg font-display font-bold text-histo-dark truncate max-w-xs sm:max-w-md">
              {topic}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Countdown
              seconds={timeRemaining}
              serverAuthoritative
              size="md"
            />
          </div>
        </div>

        {/* QuestionCard */}
        {currentQuestion && (
          <QuestionCard
            index={currentQuestionIndex}
            total={totalQuestions}
            question={currentQuestion.question}
            options={currentQuestion.options}
            selectedOption={currentParticipant.answers?.[currentQuestionIndex]}
            onSelect={(optIdx) => {
              if (!hasAnsweredCurrent) {
                submitAnswer(optIdx);
              }
            }}
            disabled={hasAnsweredCurrent}
            showCorrectAnswer={hasAnsweredCurrent}
            correctAnswer={myAnswerResult?.correct_answer ?? currentQuestion.correct_answer}
          />
        )}

        {/* Waiting for other scholars response banner */}
        {hasAnsweredCurrent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-histo bg-histo-cream border border-histo-dark/10 p-5 text-center shadow-soft"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircleIcon className="h-5 w-5 text-emerald-700" />
              <span className="text-sm font-ui font-bold text-histo-dark">
                Answer Submitted!
              </span>
            </div>
            <p className="text-xs font-body text-histo-ink/60 italic">
              Waiting for other scholars and the host to reveal the round standings...
            </p>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs font-ui">
              <span className="text-histo-copper font-bold">
                Your Score: {currentParticipant.score || 0} pts
              </span>
              {(currentParticipant.streak || 0) > 1 && (
                <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  🔥 {currentParticipant.streak} streak
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // 2. Mini-Leaderboard Between Questions
  if (roomState === 'mini_leaderboard') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <span className="text-xs font-ui font-bold uppercase tracking-wider text-histo-copper mb-1 block">
            Round {currentQuestionIndex + 1} Finished
          </span>
          <h2 className="text-2xl font-display font-bold text-histo-dark">Live Match Standings</h2>
        </div>

        <MiniLeaderboard
          participants={participants}
          currentUserId={user?.id}
          title="Top Scholars This Match"
          className="shadow-medium mb-6"
        />

        <div className="rounded-histo bg-white p-4 text-center text-xs font-ui text-histo-ink/70 border border-histo-dark/10 shadow-xs">
          <div className="h-4 w-4 border-2 border-histo-copper border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Host will advance to next question shortly...</span>
        </div>
      </div>
    );
  }

  // 3. Final Results
  if (roomState === 'final_results') {
    const sorted = finalLeaderboard.length > 0
      ? finalLeaderboard
      : [...participants].sort((a, b) => b.score - a.score);

    const myRank = sorted.findIndex((p) => p.username === user?.username) + 1 || null;

    return (
      <div className="max-w-3xl mx-auto">
        <ResultsSummary
          score={currentParticipant.score || 0}
          maxScore={totalQuestions * 150}
          correctCount={Object.keys(currentParticipant.answers || {}).length}
          wrongCount={totalQuestions - Object.keys(currentParticipant.answers || {}).length}
          totalQuestions={totalQuestions}
          timeSpentSeconds={totalQuestions * 20}
          rank={myRank}
          quizType="lobby"
          topic={topic}
          onBackToHub={onExit}
        />
      </div>
    );
  }

  return null;
}

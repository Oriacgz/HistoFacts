import { motion } from 'framer-motion';
import { FileText, Gamepad2 } from 'lucide-react';

export default function MessageBubble({ message, isOwnMessage, showSender }) {
  const isText = message.message_type === 'text';
  const isNoteShare = message.message_type === 'note_share';
  const isQuizShare = message.message_type === 'quiz_share';

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex flex-col gap-0.5 max-w-[85%] ${
        isOwnMessage ? 'self-end items-end' : 'self-start items-start'
      }`}
    >
      {/* Sender name for group chats */}
      {showSender && !isOwnMessage && (
        <div className="flex items-center gap-1.5 px-1 mb-0.5">
          <div className="h-5 w-5 rounded-full bg-histo-dark text-histo-gold flex items-center justify-center font-display font-bold text-[10px] shrink-0">
            {message.sender_username?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-[10px] font-ui font-semibold text-histo-ink/60 tracking-wide">
            {message.sender_username}#{message.sender_tag}
          </span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`rounded-lg px-3.5 py-2.5 text-[13px] font-body leading-relaxed shadow-sm ${
          isOwnMessage
            ? 'bg-histo-dark text-histo-paper rounded-br-sm'
            : 'bg-white border border-histo-dark/10 text-histo-ink rounded-bl-sm'
        }`}
      >
        {isText && <p className="whitespace-pre-wrap break-words m-0">{message.content}</p>}

        {isNoteShare && (
          <div className={`flex items-start gap-2.5 p-2 rounded-md ${
            isOwnMessage ? 'bg-white/10' : 'bg-histo-cream/60'
          }`}>
            <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${
              isOwnMessage ? 'text-histo-gold' : 'text-histo-copper'
            }`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-ui font-bold truncate m-0 ${
                isOwnMessage ? 'text-histo-paper' : 'text-histo-dark'
              }`}>
                📝 Shared Note
              </p>
              <p className={`text-[11px] mt-0.5 truncate m-0 ${
                isOwnMessage ? 'text-histo-paper/70' : 'text-histo-ink/60'
              }`}>
                {message.content}
              </p>
              <button
                type="button"
                className="mt-1.5 text-[10px] font-ui font-bold uppercase tracking-wider text-histo-gold hover:text-histo-copper transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                Open Note →
              </button>
            </div>
          </div>
        )}

        {isQuizShare && (
          <div className={`flex items-start gap-2.5 p-2 rounded-md ${
            isOwnMessage ? 'bg-white/10' : 'bg-histo-cream/60'
          }`}>
            <Gamepad2 className={`h-5 w-5 shrink-0 mt-0.5 ${
              isOwnMessage ? 'text-histo-gold' : 'text-histo-copper'
            }`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-ui font-bold m-0 ${
                isOwnMessage ? 'text-histo-paper' : 'text-histo-dark'
              }`}>
                🎮 Quiz Lobby
              </p>
              <p className={`text-[11px] mt-0.5 m-0 ${
                isOwnMessage ? 'text-histo-paper/70' : 'text-histo-ink/60'
              }`}>
                {message.content}
              </p>
              <button
                type="button"
                className={`mt-1.5 px-3 py-1 rounded-[2px] text-[10px] font-ui font-bold uppercase tracking-wider transition-colors cursor-pointer border-none ${
                  isOwnMessage
                    ? 'bg-histo-gold text-histo-dark hover:bg-histo-paper'
                    : 'bg-histo-copper text-white hover:bg-histo-dark'
                }`}
              >
                Join Quiz
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className={`text-[10px] font-ui px-1 ${
        isOwnMessage ? 'text-histo-ink/40' : 'text-histo-ink/40'
      }`}>
        {time}
      </span>
    </motion.div>
  );
}

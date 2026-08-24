import { motion } from 'framer-motion';
import {
  Send,
  Paperclip,
  Loader2,
  File,
  X,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { formatFileSize } from '../utils/tokenEstimator';

export default function PromptInputArea({
  inputValue,
  onInputChange,
  onSendMessage,
  isGenerating,
  attachedFiles,
  onRemoveAttachment,
  isProcessingFiles,
  onTriggerFileInput,
  wallet,
  estimatedTokens,
  onOpenShop,
}) {
  const isInsufficient = wallet.token_balance < (estimatedTokens || 1200);

  return (
    <div className="sticky bottom-0 z-20 border-t border-histo-dark/10 bg-histo-paper/95 backdrop-blur-md px-4 py-3 shrink-0">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Attachment Tray */}
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 p-2 bg-white/90 border border-histo-copper/30 rounded-lg shadow-xs"
          >
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1 bg-histo-cream/70 border border-histo-dark/10 rounded-md text-xs font-ui max-w-xs group"
              >
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt="attachment preview"
                    className="w-6 h-6 object-cover rounded shrink-0 border border-histo-copper/30"
                  />
                ) : file.type.includes('pdf') ? (
                  <span className="p-1 rounded bg-red-100 text-red-600 font-bold text-[9px]">
                    PDF
                  </span>
                ) : (
                  <File className="h-4 w-4 text-histo-copper shrink-0" />
                )}

                <div className="truncate min-w-0">
                  <p className="font-medium text-histo-dark truncate">{file.name}</p>
                  <p className="text-[10px] text-histo-ink/40">{formatFileSize(file.size)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  className="p-1 text-histo-ink/40 hover:text-red-500 rounded transition-colors shrink-0 cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {isProcessingFiles && (
              <div className="flex items-center gap-1 text-xs font-ui text-histo-copper px-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Extracting document...</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Prompt Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSendMessage();
          }}
        >
          <div className="relative flex items-center w-full bg-white border border-histo-dark/15 focus-within:border-histo-copper focus-within:ring-2 focus-within:ring-histo-copper/20 rounded-full shadow-soft transition-all">
            {/* Attachment Trigger Button */}
            <button
              type="button"
              onClick={onTriggerFileInput}
              className="pl-3 pr-2 py-3 text-histo-ink/50 hover:text-histo-copper transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              title="Attach PDF, Document, or Image"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask anything about history, or attach PDFs/Docs/Images..."
              disabled={isGenerating}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating && (inputValue.trim() || attachedFiles.length > 0)) {
                    onSendMessage();
                  }
                }
              }}
              className="w-full pl-2 pr-14 py-3 bg-transparent text-sm font-body text-histo-ink outline-none resize-none disabled:opacity-50 disabled:cursor-wait placeholder:text-histo-ink/40"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isGenerating || isInsufficient || (!inputValue.trim() && attachedFiles.length === 0)}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 text-white rounded-full transition-all duration-200 flex items-center justify-center shrink-0 shadow-soft cursor-pointer ${
                isInsufficient
                  ? 'bg-gray-300 cursor-not-allowed opacity-50'
                  : 'bg-histo-copper hover:bg-histo-dark active:scale-95 disabled:opacity-30 disabled:hover:bg-histo-copper disabled:cursor-not-allowed'
              }`}
              aria-label="Send query"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 ml-0.5" />
              )}
            </button>
          </div>
        </form>

        {/* Token Quota Counter & Live Estimation Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-ui px-2">
          {/* Token Quota Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenShop}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-histo-cream/80 hover:bg-histo-cream border border-histo-dark/15 rounded-full text-histo-dark hover:text-histo-copper font-medium transition-colors cursor-pointer"
              title="Click to refill tokens in Shop"
            >
              <Zap className="h-3.5 w-3.5 text-histo-copper" />
              <span>
                <strong>{wallet.token_balance.toLocaleString()}</strong> / {wallet.free_refill_cap.toLocaleString()} tokens
              </span>
            </button>

            {/* Live typing token estimate */}
            {inputValue.trim().length > 0 && (
              <span className="text-histo-ink/60 animate-fade-in hidden sm:inline">
                • ~{estimatedTokens.toLocaleString()} tokens for this note
              </span>
            )}
          </div>

          {/* Insufficient Tokens Alert or Shortcut Hint */}
          {isInsufficient ? (
            <div className="flex items-center gap-1.5 text-red-600 font-semibold animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Not enough tokens —</span>
              <button type="button" onClick={onOpenShop} className="underline hover:text-red-800 cursor-pointer">
                visit the Shop
              </button>
            </div>
          ) : (
            <span className="hidden sm:inline text-histo-ink/40 text-[10px]">
              Daily refresh +{wallet.daily_refresh_amount.toLocaleString()} tokens/day • Press Enter to send
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

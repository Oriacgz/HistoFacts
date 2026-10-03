import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Paperclip,
  Loader2,
  File,
  X,
  Square,
  Brain,
} from 'lucide-react';
import { formatFileSize, countTokens, formatTokenCount } from '../utils/tokenEstimator';

export default function PromptInputArea({
  inputValue,
  onInputChange,
  onSendMessage,
  isGenerating,
  onStopGenerating,
  attachedFiles,
  onRemoveAttachment,
  isProcessingFiles,
  onTriggerFileInput,
  isInsufficient,
  thinkEnabled,
  onToggleThink,
  wallet,
  streamingPrompt = '',
  streamingText = '',
  streamingAttachments = [],
  onOpenShop,
}) {
  const textareaRef = useRef(null);

  // ── Real-time Token Usage Calculation ─────────────────────────
  const quotaLimit = wallet?.free_refill_cap || 350000;
  const baseBalance = wallet?.token_balance ?? 350000;

  let liveStreamTokens = 0;
  if (isGenerating) {
    const promptTokens = countTokens(streamingPrompt);
    let attachmentTokens = 0;
    (streamingAttachments || []).forEach((a) => {
      if (a.extractedText) {
        attachmentTokens += Math.round(a.extractedText.length / 4);
      } else if (a.size) {
        attachmentTokens += 500;
      }
    });
    const outputTokens = countTokens(streamingText);
    liveStreamTokens = promptTokens + attachmentTokens + outputTokens;
  }

  const remainingTokens = Math.max(0, baseBalance - liveStreamTokens);
  const usedTokens = Math.min(quotaLimit, Math.max(0, (quotaLimit - baseBalance) + liveStreamTokens));
  const isLowTokens = remainingTokens < 20000;

  // ── Auto-expand textarea ─────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputValue]);

  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (isGenerating || isInsufficient) return;
    if (!inputValue.trim() && attachedFiles.length === 0) return;

    onSendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = !isGenerating && !isInsufficient && (inputValue.trim() || attachedFiles.length > 0);

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
            handleSubmit(e);
          }}
        >
          <div className="relative flex items-end w-full bg-white border border-histo-dark/15 focus-within:border-histo-copper focus-within:ring-2 focus-within:ring-histo-copper/20 rounded-2xl shadow-soft transition-all">
            {/* Left controls: Attachment + Think */}
            <div className="flex items-center gap-0.5 pl-2 pb-2.5">
              {/* Attachment Trigger Button */}
              <button
                type="button"
                onClick={onTriggerFileInput}
                className="p-1.5 text-histo-ink/40 hover:text-histo-copper transition-colors flex items-center justify-center shrink-0 cursor-pointer rounded-lg hover:bg-histo-cream/60"
                title="Attach PDF, Document, or Image"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Think Toggle */}
              <button
                type="button"
                onClick={onToggleThink}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-ui font-medium transition-all cursor-pointer ${
                  thinkEnabled
                    ? 'bg-violet-100 text-violet-700 border border-violet-300 shadow-xs'
                    : 'text-histo-ink/40 hover:text-histo-ink/60 hover:bg-histo-cream/60'
                }`}
                title={thinkEnabled ? 'Think Mode ON: Deeper reasoning for difficult questions. May take a bit longer.' : 'Think Mode OFF: Fast responses. Turn ON for step-by-step reasoning on complex questions.'}
                aria-label={thinkEnabled ? 'Think Mode ON: Deeper reasoning for difficult questions.' : 'Think Mode OFF: Click to turn on deeper reasoning.'}
                aria-pressed={thinkEnabled}
              >
                <Brain className={`h-3.5 w-3.5 ${thinkEnabled ? 'text-violet-600' : ''}`} />
                <span className="hidden sm:inline">Think</span>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask anything about history..."
              rows={1}
              onKeyDown={handleKeyDown}
              className="w-full pl-1 pr-12 py-3 bg-transparent text-sm font-body text-histo-ink outline-none resize-none placeholder:text-histo-ink/40"
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />

            {/* Send / Stop Button */}
            <div className="pr-1.5 pb-1.5">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStopGenerating}
                  className="h-9 w-9 text-white rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-soft cursor-pointer"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-white" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="h-9 w-9 text-white rounded-xl bg-histo-copper hover:bg-histo-dark active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-soft cursor-pointer disabled:opacity-30 disabled:hover:bg-histo-copper disabled:cursor-not-allowed"
                  aria-label="Send query"
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Modern Compact Token Usage Meter & Composer Footer */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-ui px-1.5 text-histo-ink/45">
          <button
            type="button"
            onClick={onOpenShop}
            className="flex items-center gap-1.5 hover:text-histo-dark transition-colors group cursor-pointer text-left py-0.5"
            title="Daily AI Study Credits: Your daily reading and generation quota. Click to view details or refill with Histoins."
            aria-label="Daily AI study credit usage. Click to open Token Shop"
          >
            {isGenerating ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-histo-copper/60 group-hover:bg-histo-copper shrink-0" />
            )}
            <span className="font-medium text-histo-dark/80">
              {formatTokenCount(usedTokens)} / {formatTokenCount(quotaLimit)} used
            </span>
            <span className="text-histo-ink/25">·</span>
            <span className={isLowTokens ? 'text-amber-600 font-semibold' : 'text-histo-ink/65'}>
              {formatTokenCount(remainingTokens)} remaining
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-histo-ink/30">
            <span>Enter to send · Shift+Enter for newline</span>
            {thinkEnabled && <span className="text-violet-600 font-medium">· Think ON</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

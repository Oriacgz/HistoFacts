import SessionMemory from './SessionMemory';
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
  Globe,
  ChevronDown,
} from 'lucide-react';
import { formatFileSize, countTokens, formatTokenCount } from '../utils/tokenEstimator';

export default function PromptInputArea({
  inputValue,
  contextSessionId = null,
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
  researchEnabled = false,
  onToggleResearch,
  researchAvailable = false,
  wallet,
  streamingPrompt = '',
  streamingText = '',
  streamingAttachments = [],
  onOpenShop,
}) {
  const textareaRef = useRef(null);
  const optionsRef = useRef(null);
  useEffect(() => {
    const closeOutside = event => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) optionsRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

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
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = !isGenerating && !isInsufficient && (inputValue.trim() || attachedFiles.length > 0);

  return (
    <div className="sticky bottom-0 z-20 border-t border-histo-dark/10 bg-histo-paper/95 backdrop-blur-md px-4 py-3 shrink-0">
      <div className="max-w-4xl mx-auto space-y-2">
        {researchEnabled && <p className="text-xs font-ui text-histo-ink/60">Search terms are sent to Tavily. Attachments are analyzed separately. Sources may be incomplete or disagree.</p>}
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
          <div className="relative flex flex-col w-full bg-white border border-histo-dark/15 focus-within:border-histo-copper focus-within:ring-2 focus-within:ring-histo-copper/15 rounded-2xl shadow-soft transition-all">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask anything about history..."
              rows={1}
              onKeyDown={handleKeyDown}
              className="w-full min-w-0 px-4 pt-3 pb-2 rounded-t-2xl bg-transparent text-sm font-ui leading-6 text-histo-ink outline-none resize-none overflow-y-auto placeholder:text-histo-ink/40"
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />

            <div className="flex w-full items-center justify-between gap-2 px-2 pb-2">
            {/* Attachment and answer options */}
            <div className="flex min-w-0 items-center gap-1">
              {/* Attachment Trigger Button */}
              <button
                type="button"
                onClick={onTriggerFileInput}
                className="p-1.5 text-histo-ink/40 hover:text-histo-copper transition-colors flex items-center justify-center shrink-0 cursor-pointer rounded-lg hover:bg-histo-cream/60"
                title="Attach PDF, Document, or Image"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <details ref={optionsRef} className="relative min-w-0" onKeyDown={event => {
                if (event.key === 'Escape') { optionsRef.current.open = false; optionsRef.current.querySelector('summary').focus(); }
              }}>
                <summary aria-label="Think and Web Search options" className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-ui text-histo-ink/70 hover:bg-histo-cream focus-visible:outline-2 focus-visible:outline-histo-copper [&::-webkit-details-marker]:hidden">
                  {thinkEnabled ? <Brain className="h-4 w-4 text-violet-600" /> : <Globe className="h-4 w-4" />}
                  <span className="truncate">{thinkEnabled && researchEnabled ? 'Think + Web Search' : thinkEnabled ? 'Think' : researchEnabled ? 'Web Search' : 'Options'}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </summary>
                <fieldset className="absolute bottom-full left-0 z-40 mb-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-histo-dark/15 bg-white p-2 shadow-xl text-histo-ink">
                  <legend className="sr-only">Answer options</legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-histo-cream/60">
                    <Brain className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <span className="min-w-0 flex-1 font-ui text-sm">Think<span className="mt-1 block text-xs text-histo-ink/60">Deeper reasoning with Qwen.</span></span>
                    <input type="checkbox" aria-label="Think" checked={thinkEnabled} onChange={onToggleThink} disabled={isGenerating} className="mt-1 accent-violet-600" />
                  </label>
                  <label className={`flex items-start gap-3 rounded-lg p-3 ${researchAvailable ? 'cursor-pointer hover:bg-histo-cream/60' : 'opacity-50'}`}>
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-histo-copper" />
                    <span className="min-w-0 flex-1 font-ui text-sm">Web Search<span className="mt-1 block text-xs text-histo-ink/60">{researchAvailable ? 'Search public sources with citations.' : 'Requires a configured search key.'}</span></span>
                    <input type="checkbox" aria-label="Web Search" checked={researchEnabled} onChange={onToggleResearch} disabled={isGenerating || !researchAvailable} className="mt-1 accent-amber-600" />
                  </label>
                </fieldset>
              </details>
            </div>



            {/* Send / Stop Button */}
            <div className="flex shrink-0 items-center gap-2">
              <SessionMemory sessionId={contextSessionId} generating={isGenerating} draft={inputValue} streamingText={isGenerating ? streamingText : ''} />
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

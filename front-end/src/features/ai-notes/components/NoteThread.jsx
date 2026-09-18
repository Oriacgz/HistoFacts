import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Copy,
  CheckCircle2,
  PenTool,
  Loader2,
  Paperclip,
  Share2,
  ArrowDown,
  Download,
} from 'lucide-react';
import MarkdownBlockViewer from './MarkdownBlockViewer';
import HandwrittenBlockViewer from './HandwrittenBlockViewer';
import { printHandwrittenNote } from '../utils/pdfGenerator';

export default function NoteThread({
  chain = [],
  isStreaming = false,
  streamingPrompt = '',
  streamingText = '',
  streamingAttachments = [],
  onConvertToHandwritten,
  isRestylingId = null,
  onCopyNote,
  copiedNoteId = null,
  onShare,
  scrollContainerRef,
}) {
  const bottomRef = useRef(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const userScrolledRef = useRef(false);

  // ── Scroll position tracking ──────────────────────────────────
  const checkIfNearBottom = useCallback(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    const threshold = 150;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distFromBottom <= threshold);
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return undefined;

    const handleScroll = () => {
      checkIfNearBottom();
      // If streaming and user scrolled up — mark as intentional
      if (isStreaming) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 200) {
          userScrolledRef.current = true;
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, checkIfNearBottom, isStreaming]);

  // ── Auto-follow only when near bottom ─────────────────────────
  useEffect(() => {
    if (!userScrolledRef.current && isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chain.length, streamingText, isNearBottom]);

  // Reset userScrolled when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  // ── Jump to latest ─────────────────────────────────────────────
  const jumpToLatest = useCallback(() => {
    userScrolledRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6 px-4 sm:px-6 relative">
      {/* Thread Turns */}
      {chain.map((turn, i) => {
        const isLatest = i === chain.length - 1 && !isStreaming;
        return (
          <React.Fragment key={turn.id || `turn-${i}`}>
            {turn.prompt && (
              <UserTurn
                text={turn.prompt}
                attachmentName={turn.attachment_name}
              />
            )}
            <AssistantTurn
              note={turn}
              isLatest={isLatest}
              onCopy={onCopyNote}
              isCopied={copiedNoteId === turn.id}
              onShare={onShare}
            />
          </React.Fragment>
        );
      })}

      {/* In-progress streaming turn */}
      {isStreaming && (
        <>
          {streamingPrompt && (
            <UserTurn
              text={streamingPrompt}
              attachments={streamingAttachments}
            />
          )}
          <div className="flex gap-3.5 items-start">
            <AiAvatar />
            <div className="min-w-0 flex-1">
              {!streamingText ? (
                <div className="flex items-center gap-2.5 py-3 text-xs font-ui text-histo-ink/60">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-histo-copper animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-histo-copper animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-histo-copper animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="font-medium text-histo-dark/70">
                    Generating...
                  </span>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none">
                  <MarkdownBlockViewer content={streamingText} />
                  {/* Streaming cursor */}
                  <span className="inline-block w-2 h-4 bg-histo-copper/70 rounded-sm animate-pulse ml-0.5 align-text-bottom" />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div ref={bottomRef} className="h-1" />

      {/* ── Jump to Latest floating button (compact bottom-right, never covers content) ── */}
      <AnimatePresence>
        {!isNearBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={jumpToLatest}
            className="fixed bottom-24 right-6 sm:right-10 z-30 inline-flex items-center justify-center w-9 h-9 rounded-full bg-histo-dark/85 text-white shadow-md hover:bg-histo-dark hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-sm border border-white/15"
            title="Jump to latest response"
            aria-label="Jump to latest response"
          >
            <ArrowDown className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserTurn({ text, attachments = [], attachmentName = null }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-slate-100 dark:bg-stone-800 px-4 py-2.5 text-sm text-slate-800 dark:text-stone-100 shadow-2xs space-y-1.5">
        {(attachments.length > 0 || attachmentName) && (
          <div className="flex flex-wrap gap-1.5 pb-1 border-b border-black/5 dark:border-white/10">
            {attachmentName && (
              <span className="inline-flex items-center gap-1 text-[11px] font-ui px-2 py-0.5 bg-white/70 dark:bg-black/20 rounded-md text-histo-copper">
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[160px]">{attachmentName}</span>
              </span>
            )}
            {attachments.map((f, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-ui px-2 py-0.5 bg-white/70 dark:bg-black/20 rounded-md text-histo-copper"
              >
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[160px]">{f.name}</span>
              </span>
            ))}
          </div>
        )}
        <p className="font-body leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function AssistantTurn({
  note,
  isLatest,
  onCopy,
  isCopied,
  onShare,
}) {
  const [isHandwrittenView, setIsHandwrittenView] = useState(note.style === 'handwritten');
  const handwrittenContainerRef = useRef(null);
  const hiddenHandwrittenRef = useRef(null);

  const handleToggleStyle = useCallback(() => {
    setIsHandwrittenView((prev) => !prev);
  }, []);

  const handleDownloadPdf = useCallback(() => {
    const sourceEl = isHandwrittenView
      ? handwrittenContainerRef.current
      : hiddenHandwrittenRef.current;
    if (!sourceEl) return;

    printHandwrittenNote({
      title: note.title || note.prompt || 'Historical Notes',
      htmlContent: sourceEl.innerHTML,
      createdAt: note.created_at,
    });
  }, [note, isHandwrittenView]);

  const Viewer = isHandwrittenView ? HandwrittenBlockViewer : MarkdownBlockViewer;

  return (
    <div className="flex gap-3.5 items-start">
      <AiAvatar isHandwritten={isHandwrittenView} />
      <div className="min-w-0 flex-1">
        <div
          ref={isHandwrittenView ? handwrittenContainerRef : null}
          className="prose prose-slate max-w-none"
        >
          <Viewer content={note.content} />
        </div>

        {/* Hidden pre-rendered handwritten block to ensure instant PDF download even from normal view */}
        {!isHandwrittenView && (
          <div className="hidden" aria-hidden="true">
            <div ref={hiddenHandwrittenRef}>
              <HandwrittenBlockViewer content={note.content} />
            </div>
          </div>
        )}

        {/* Action toolbar for turn */}
        <MessageActions
          note={note}
          isLatest={isLatest}
          isHandwritten={isHandwrittenView}
          onToggleHandwritten={handleToggleStyle}
          onCopy={onCopy}
          isCopied={isCopied}
          onShare={onShare}
          onDownloadPdf={handleDownloadPdf}
        />
      </div>
    </div>
  );
}

function AiAvatar({ isHandwritten = false }) {
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-2xs border transition-colors ${
        isHandwritten
          ? 'bg-amber-100/80 text-amber-800 border-amber-300'
          : 'bg-histo-copper/15 text-histo-copper border-histo-copper/30'
      }`}
      title={isHandwritten ? 'Student Handwritten Notes' : 'HistoFacts AI'}
    >
      {isHandwritten ? (
        <PenTool className="h-4 w-4 text-amber-800" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </div>
  );
}

function MessageActions({
  note,
  isLatest,
  isHandwritten,
  onToggleHandwritten,
  onCopy,
  isCopied,
  onShare,
  onDownloadPdf,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-histo-dark/10">
      {/* Copy Action */}
      <button
        type="button"
        onClick={() => onCopy(note)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-white border border-histo-dark/15 hover:border-histo-copper hover:bg-histo-cream transition-all font-ui text-xs text-histo-ink/70 hover:text-histo-copper cursor-pointer shadow-2xs"
        title="Copy response"
      >
        {isCopied ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-600 font-semibold text-[11px]">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Copy</span>
          </>
        )}
      </button>

      {/* Share Action */}
      {onShare && (
        <button
          type="button"
          onClick={() => onShare(note)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-white border border-histo-dark/15 hover:border-histo-copper hover:bg-histo-cream transition-all font-ui text-xs text-histo-ink/70 hover:text-histo-copper cursor-pointer shadow-2xs"
          title="Share note to direct chat or group"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Share</span>
        </button>
      )}

      {/* Mode Switch: Normal Answer <-> Handwritten Style */}
      {onToggleHandwritten && (
        <button
          type="button"
          onClick={onToggleHandwritten}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border transition-all font-ui text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 ${
            isHandwritten
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
          }`}
          title={isHandwritten ? 'Switch to normal standard view' : 'Switch to handwritten study notes view'}
        >
          {isHandwritten ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-[11px]">Normal View</span>
            </>
          ) : (
            <>
              <PenTool className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-[11px]">Handwritten Style</span>
            </>
          )}
        </button>
      )}

      {/* Download PDF Action */}
      {onDownloadPdf && (
        <button
          type="button"
          onClick={onDownloadPdf}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border transition-all font-ui text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 ${
            isHandwritten
              ? 'bg-amber-100 hover:bg-amber-200/90 border-amber-300 text-amber-950 shadow-xs'
              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
          }`}
          title="Download handwritten study note as printable A4 PDF"
        >
          <Download className="h-3.5 w-3.5 text-amber-800" />
          <span className="text-[11px]">Download PDF</span>
        </button>
      )}
    </div>
  );
}

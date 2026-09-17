import React, { useEffect, useRef } from 'react';
import { Sparkles, Copy, CheckCircle2, PenTool, Loader2, Paperclip, Share2 } from 'lucide-react';
import MarkdownBlockViewer from './MarkdownBlockViewer';
import HandwrittenBlockViewer from './HandwrittenBlockViewer';

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
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chain, isStreaming, streamingText]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6 px-4 sm:px-6">
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
              onConvertToHandwritten={onConvertToHandwritten}
              isRestyling={isRestylingId === turn.id}
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
                <div className="flex items-center gap-2 py-2 text-xs font-ui text-histo-ink/60">
                  <Sparkles className="h-4 w-4 text-histo-copper animate-spin" />
                  <span className="font-semibold text-histo-dark animate-pulse">
                    Thinking & analyzing history sources...
                  </span>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none">
                  <MarkdownBlockViewer content={streamingText} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div ref={bottomRef} />
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
  onConvertToHandwritten,
  isRestyling,
  onCopy,
  isCopied,
  onShare,
}) {
  const isHandwritten = note.style === 'handwritten';
  const Viewer = isHandwritten ? HandwrittenBlockViewer : MarkdownBlockViewer;

  return (
    <div className="flex gap-3.5 items-start">
      <AiAvatar isHandwritten={isHandwritten} />
      <div className="min-w-0 flex-1">
        <div className="prose prose-slate max-w-none">
          <Viewer content={note.content} />
        </div>
        {/* Action toolbar for turn */}
        <MessageActions
          note={note}
          isLatest={isLatest}
          isHandwritten={isHandwritten}
          onConvertToHandwritten={onConvertToHandwritten}
          isRestyling={isRestyling}
          onCopy={onCopy}
          isCopied={isCopied}
          onShare={onShare}
        />
      </div>
    </div>
  );
}

function AiAvatar({ isHandwritten = false }) {
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-2xs border ${
        isHandwritten
          ? 'bg-amber-100/70 text-amber-800 border-amber-300'
          : 'bg-histo-copper/15 text-histo-copper border-histo-copper/30'
      }`}
      title={isHandwritten ? 'Handwritten Lecture Notes' : 'HistoFacts AI'}
    >
      {isHandwritten ? (
        <PenTool className="h-4 w-4" />
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
  onConvertToHandwritten,
  isRestyling,
  onCopy,
  isCopied,
  onShare,
}) {
  return (
    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-histo-dark/10">
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

      {/* Restyle as handwritten (available on standard style notes) */}
      {!isHandwritten && isLatest && onConvertToHandwritten && (
        <button
          type="button"
          onClick={() => onConvertToHandwritten(note.id)}
          disabled={isRestyling}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 transition-all font-ui text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
          title="Restyle as student handwritten class notes"
        >
          {isRestyling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
              <span className="text-[11px]">Converting...</span>
            </>
          ) : (
            <>
              <PenTool className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-[11px]">Handwritten Style</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

import { useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Copy, CheckCircle2 } from 'lucide-react';

/**
 * Proper Markdown renderer using react-markdown with GFM tables, code highlighting,
 * and a Copy button on fenced code blocks. Styled to match HistoFacts design language.
 */
const MarkdownBlockViewer = memo(function MarkdownBlockViewer({ content }) {
  if (!content) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={mdComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

export default MarkdownBlockViewer;

/* ── Custom component overrides ──────────────────────────────────────────── */

function CodeBlock({ children, className, _node, ...props }) {
  const [copied, setCopied] = useState(false);
  const isInline = !className && typeof children === 'string' && !children.includes('\n');

  const handleCopy = useCallback(() => {
    const text = typeof children === 'string' ? children : '';
    navigator.clipboard.writeText(text.replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-histo-cream/80 border border-histo-dark/10 text-[13px] font-mono text-histo-dark"
        {...props}
      >
        {children}
      </code>
    );
  }

  // Fenced code block
  const lang = className?.replace('language-', '') || '';
  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-histo-dark/10 shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-histo-dark/10 text-[11px] font-ui text-histo-ink/50">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/80 transition-colors cursor-pointer text-histo-ink/50 hover:text-histo-copper"
          title="Copy code"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="!m-0 !rounded-none overflow-x-auto bg-slate-50 p-3 text-[13px] leading-relaxed">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

const mdComponents = {
  // ── Headings ──
  h1: ({ children }) => (
    <div className="pb-2 border-b border-histo-copper/20 pt-1 mb-3">
      <h1 className="font-display text-xl sm:text-2xl font-bold text-histo-dark tracking-tight">
        {children}
      </h1>
    </div>
  ),
  h2: ({ children }) => (
    <div className="pt-4 pb-1.5 flex items-center gap-2 border-b border-histo-dark/10 text-histo-dark">
      <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-histo-dark">
        {children}
      </h2>
    </div>
  ),
  h3: ({ children }) => (
    <h3 className="font-display text-sm sm:text-base font-bold text-histo-dark pt-3 pb-1">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-display text-sm font-semibold text-histo-dark pt-2 pb-0.5">
      {children}
    </h4>
  ),

  // ── Paragraph ──
  p: ({ children }) => (
    <p className="font-body text-sm text-histo-ink/90 leading-relaxed my-2">
      {children}
    </p>
  ),

  // ── Strong / Em ──
  strong: ({ children }) => (
    <strong className="text-histo-dark font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-histo-ink/80">{children}</em>
  ),

  // ── Lists ──
  ul: ({ children }) => (
    <ul className="space-y-1 my-2 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 my-2 pl-1 counter-reset-list">{children}</ol>
  ),
  li: ({ children, ordered, index }) => {
    if (ordered !== undefined && ordered) {
      return (
        <li className="flex items-start gap-2.5 my-1">
          <span className="h-5 w-5 rounded-full bg-histo-copper/15 text-histo-copper font-ui font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            {(index ?? 0) + 1}
          </span>
          <div className="font-body text-sm text-histo-ink flex-1 leading-relaxed">
            {children}
          </div>
        </li>
      );
    }
    return (
      <li className="flex items-start gap-2.5 my-0.5 pl-1">
        <span className="h-1.5 w-1.5 rounded-full bg-histo-copper shrink-0 mt-2" />
        <div className="font-body text-sm text-histo-ink flex-1 leading-relaxed">
          {children}
        </div>
      </li>
    );
  },

  // ── Blockquote ──
  blockquote: ({ children }) => (
    <div className="p-3 my-3 bg-histo-copper/5 border-l-3 border-histo-copper rounded-r-md italic font-body text-sm text-histo-ink/90">
      {children}
    </div>
  ),

  // ── Code ──
  code: CodeBlock,

  // ── Table ──
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-histo-dark/15 shadow-xs">
      <table className="min-w-full text-sm font-body">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-histo-cream/60 border-b border-histo-dark/15">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-histo-dark/8">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-histo-cream/30 transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-display font-semibold text-histo-dark text-xs uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-histo-ink/85 text-sm">{children}</td>
  ),

  // ── Horizontal Rule ──
  hr: () => <hr className="my-4 border-t border-histo-dark/15" />,

  // ── Link ──
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-histo-copper hover:text-histo-dark underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
};

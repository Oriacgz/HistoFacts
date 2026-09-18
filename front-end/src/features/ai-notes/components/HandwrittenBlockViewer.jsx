import { useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Regex matching decorative emojis commonly used by AI models (e.g. 📌, 🏛️, 📜, 🔍, 🎯, ❓, ⭐, 🔹, ✅, ❗, etc.)
 * Note: Mathematical / directional symbols like arrows (→, ↔) are intentionally excluded and preserved.
 */
const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{FE00}-\u{FE0F}\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu;

/**
 * Pre-process markdown content for handwritten notes:
 * - Strips all decorative AI emoji markers
 * - Normalizes standard section titles (whether preceded by bullets, bold, or hashes) into clean ## Headings
 * - Normalizes standalone bold lines that function as section titles
 * - Normalizes bold labels with spaces before colons ("**Core Idea** :" -> "**Core Idea:**")
 * - Cleans heading hashes and collapses excessive spaces
 */
function cleanHandwrittenMarkdown(content) {
  if (!content) return '';
  return content
    // 1. Strip decorative emojis
    .replace(EMOJI_REGEX, '')
    // 2. Normalize standard curriculum section titles (even if prefixed by bullets or bold) into ## Headings
    .replace(/^[-*•]?\s*\*{0,2}(Historical Context[^*\n]*|Source & Document[^*\n]*|Examination &[^*\n]*|Self-Assessment[^*\n]*|Chronological Timeline[^*\n]*|Key Takeaways[^*\n]*)\*{0,2}/gim, '## $1')
    // 3. Convert any other standalone bold lines that function as section titles: "**Some Section Title**" -> "## Some Section Title"
    .replace(/^(?:\s*)\*\*([A-Z][^*\n]{3,60})\*\*(?:\s*)$/gm, '## $1')
    // 4. Normalize bold labels with detached colons: "**Core Idea** :" -> "**Core Idea:**"
    .replace(/\*\*([^*]+)\*\*\s*:/g, '**$1:**')
    // 5. Ensure headings have clean format
    .replace(/^(#{1,6})[ \t]+/gm, '$1 ')
    // 6. Collapse multiple horizontal spaces
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Extract plain text recursively from React nodes to inspect contents
 */
function getTextContent(node) {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (node && node.props && node.props.children) return getTextContent(node.props.children);
  return '';
}

/**
 * Selective highlighter heuristic:
 * - Highlight only genuine short historical terms/concepts (1-4 words), e.g. "National Assembly", "Tennis Court Oath", "Estates-General"
 * - Never highlight structural labels ("Core Idea:", "Answer:"), dates ("May 5, 1789"), table headers ("Date", "Significance"), section titles, or full sentences
 */
function shouldHighlight(text) {
  const t = text.trim();
  if (!t || t.length < 3) return false;
  // Exclude labels ending with colon
  if (t.endsWith(':') || t.endsWith(' :')) return false;
  // Exclude dates and years
  if (/\b(1[0-9]{3}|20[0-9]{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(t)) return false;
  // Exclude section titles, headers, and chapter/question markers
  if (/(context|background|analysis|curriculum|relevance|assessment|takeaway|timeline|practice|summary|notes|overview)/i.test(t)) return false;
  if (/^(date|event|significance|topic|year|cause|effect|outcome|name|status|details|chapter \d+|section \d+|question \d+)$/i.test(t)) return false;
  // Exclude full sentences
  const words = t.split(/\s+/);
  if (words.length > 4) return false;
  return true;
}

/**
 * Authentic Handwritten Study Note Renderer:
 * - Proper AST parsing with ReactMarkdown & remarkGfm
 * - Realistic print handwriting typography (Patrick Hand & Kalam)
 * - Authentic pen-drawn hierarchy: double underline on main topic, single underline on sections
 * - Circled list numbers and clean pen bullets
 * - Thin pen-drawn responsive study tables with shaded headers
 * - Selective highlighter pen only on key terms (never on labels, dates, or headings)
 * - Open, spacious student revision notebook layout without rigid template widgets
 */
const HandwrittenBlockViewer = memo(function HandwrittenBlockViewer({ content }) {
  const cleanedContent = useMemo(() => cleanHandwrittenMarkdown(content), [content]);

  if (!cleanedContent) return null;

  return (
    <div className="handwritten-notebook p-6 sm:p-10 rounded-xl border border-stone-200/80 shadow-xs bg-[#faf8f5] select-text relative">
      {/* Authentic Notebook Content — Open, spacious, student revision rhythm */}
      <div className="font-handwriting text-[#162a45] space-y-2 max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={handwrittenComponents}
        >
          {cleanedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
});

export default HandwrittenBlockViewer;

/* ── Custom Handwritten Markdown Components ───────────────────────────────── */

const handwrittenComponents = {
  // ── Main Topic / Heading 1: Double pen underline ──
  h1: ({ children }) => (
    <div className="mb-6 mt-1 pb-1">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-[#11223b] uppercase inline-block font-handwriting">
        {children}
      </h1>
      {/* Authentic double pen underline */}
      <div className="w-full max-w-sm h-[3px] border-t-2 border-b border-[#11223b]/55 mt-1" />
    </div>
  ),

  // ── Subtopic / Section Heading 2: Single pen underline ──
  h2: ({ children }) => (
    <div className="mt-7 mb-3">
      <h2 className="text-xl sm:text-2xl font-bold text-[#162b47] inline-block border-b-2 border-[#162b47]/45 pb-0.5 tracking-wide font-handwriting">
        {children}
      </h2>
    </div>
  ),

  // ── Sub-heading 3 ──
  h3: ({ children }) => (
    <h3 className="text-lg sm:text-xl font-bold text-[#1d3557] mt-5 mb-2 inline-block font-handwriting border-b border-slate-600/30 pb-0.5">
      {children}
    </h3>
  ),

  // ── Minor Heading 4 ──
  h4: ({ children }) => (
    <h4 className="text-base sm:text-lg font-bold text-[#243d60] mt-3.5 mb-1.5 font-handwriting">
      {children}
    </h4>
  ),

  // ── Paragraphs: Natural handwritten line spacing, mostly open space ──
  p: ({ children }) => {
    return (
      <p className="my-2.5 text-lg sm:text-xl leading-[30px] sm:leading-[32px] text-[#162a45] font-normal tracking-wide">
        {children}
      </p>
    );
  },

  // ── Bullet & Numbered Lists ──
  ul: ({ children }) => (
    <ul className="my-2.5 pl-1 space-y-1.5 list-none">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="my-2.5 pl-1 space-y-2 list-none">
      {children}
    </ol>
  ),

  li: ({ children, ordered, index }) => {
    if (ordered) {
      return (
        <li className="flex items-start gap-2.5 my-1.5 text-lg sm:text-xl leading-[28px] sm:leading-[30px] text-[#162a45]">
          <span className="select-none inline-flex items-center justify-center w-5 h-5 rounded-full border border-[#162b47]/40 text-xs font-bold text-[#11223b] shrink-0 mt-1 bg-white/60 shadow-2xs">
            {(index ?? 0) + 1}
          </span>
          <div className="flex-1 min-w-0">{children}</div>
        </li>
      );
    }
    return (
      <li className="flex items-start gap-2.5 my-1 text-lg sm:text-xl leading-[28px] sm:leading-[30px] text-[#162a45]">
        <span className="select-none text-[#2d4b6a] font-bold mt-[-1px] shrink-0 text-base">•</span>
        <div className="flex-1 min-w-0">{children}</div>
      </li>
    );
  },

  // ── Selective Highlighting: Only on key terms, never on labels, dates, or headings ──
  strong: ({ children }) => {
    const text = getTextContent(children);
    if (shouldHighlight(text)) {
      return (
        <strong className="font-bold text-[#0c1829] bg-yellow-200/40 px-1 py-0.5 rounded-[2px] shadow-[0_1px_1px_rgba(245,158,11,0.06)]">
          {children}
        </strong>
      );
    }

    return (
      <strong className="font-bold text-[#0e1d33]">
        {children}
      </strong>
    );
  },

  em: ({ children }) => (
    <em className="italic text-[#1d3557] underline decoration-slate-400/50 decoration-1 underline-offset-2">
      {children}
    </em>
  ),

  // ── Boxed Definition / Exam Tip (only for genuine callouts, open everywhere else) ──
  blockquote: ({ children }) => (
    <blockquote className="my-4 p-3.5 sm:p-4 rounded-md border border-[#2d4b6a]/35 bg-[#f5f1e6]/60 relative text-[#162a45] text-lg sm:text-xl leading-[28px] shadow-2xs">
      <div className="italic">{children}</div>
    </blockquote>
  ),

  // ── Clean Handwritten Study Tables: Thin pen borders, shaded header, responsive ──
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-slate-700/35 bg-white/45 shadow-2xs">
      <table className="min-w-full text-base sm:text-lg leading-[26px] divide-y border-collapse divide-slate-700/30 font-handwriting">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="border-b-2 border-slate-700/40 bg-amber-50/70">
      {children}
    </thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-slate-700/20">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="hover:bg-amber-50/30 transition-colors">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th className="px-3.5 py-2 text-left font-bold text-[#11223b] border-r border-slate-700/25 last:border-r-0 tracking-wide text-base sm:text-lg">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-3.5 py-2 text-[#162a45] border-r border-slate-700/15 last:border-r-0 align-top text-base sm:text-lg">
      {children}
    </td>
  ),

  // ── Code Blocks: Clean ruled student code box ──
  code: ({ children, className, ...props }) => {
    const isInline = !className && typeof children === 'string' && !children.includes('\n');
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-amber-100/50 border border-slate-700/20 text-sm font-mono text-[#11223b]" {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre className="my-3 p-3 rounded-md border border-slate-700/25 bg-white/60 text-xs sm:text-sm font-mono text-[#11223b] overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },

  // ── Hand-drawn Divider Line ──
  hr: () => (
    <div className="my-5 flex items-center justify-center gap-2">
      <div className="flex-1 border-t border-slate-700/20" />
      <span className="text-xs text-slate-400 select-none">~</span>
      <div className="flex-1 border-t border-slate-700/20" />
    </div>
  ),

  // ── Links ──
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#1a4a75] underline underline-offset-2 hover:text-[#0f2d4a] transition-colors"
    >
      {children}
    </a>
  ),
};

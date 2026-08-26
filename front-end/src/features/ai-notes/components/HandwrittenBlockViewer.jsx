export default function HandwrittenBlockViewer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="handwritten-notebook p-6 sm:p-8 rounded-lg border border-blue-200/50 shadow-inner text-[#1b2a4a] text-xl sm:text-2xl leading-[28px] tracking-wide select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-4" />;

        if (trimmed.startsWith('# ')) {
          return (
            <div key={idx} className="pb-1 border-b-2 border-red-300/60 mb-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#142340] tracking-tight">
                {trimmed.replace(/^#\s+/, '')}
              </h2>
            </div>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <div key={idx} className="pt-3 pb-1 text-[#2d4b6a] font-bold text-xl sm:text-2xl flex items-center gap-2">
              <span>{trimmed.replace(/^##\s+/, '')}</span>
            </div>
          );
        }

        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const raw = trimmed.replace(/^[•\-*]\s+/, '');
          return (
            <div key={idx} className="pl-4 my-1 flex items-start gap-2">
              <span className="text-histo-copper font-bold">•</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: raw
                    .replace(/→/g, '<span class="text-red-500 font-bold px-1">→</span>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-950 font-bold underline decoration-amber-400 decoration-2">$1</strong>'),
                }}
              />
            </div>
          );
        }

        return (
          <p
            key={idx}
            className="my-1 pl-2"
            dangerouslySetInnerHTML={{
              __html: trimmed
                .replace(/→/g, '<span class="text-red-500 font-bold px-1">→</span>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-950 font-bold underline decoration-amber-400 decoration-2">$1</strong>'),
            }}
          />
        );
      })}
    </div>
  );
}

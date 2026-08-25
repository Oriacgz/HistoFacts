import { motion } from 'framer-motion';
import { Sparkles, Upload } from 'lucide-react';
import { SUGGESTED_PROMPTS } from '../constants';

export default function WelcomeCanvas({ onSelectPrompt, onTriggerFileInput }) {
  return (
    <motion.div
      key="welcome-canvas"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[65vh] text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-histo-copper/15 border border-histo-copper/30 flex items-center justify-center mb-4 shadow-soft">
        <Sparkles className="h-7 w-7 text-histo-copper" />
      </div>

      <h2 className="font-display text-2xl sm:text-3xl font-bold text-histo-dark mb-2 tracking-tight">
        Your AI History Tutor
      </h2>
      <p className="font-body text-histo-ink/70 mb-8 max-w-lg leading-relaxed text-sm sm:text-base">
        Ask any historical question, request exam breakdowns, or attach PDFs, documents, and images to generate structured study notes.
      </p>

      {/* Drag and Drop Zone */}
      <div
        onClick={onTriggerFileInput}
        className="w-full max-w-2xl mb-8 p-5 bg-white/80 hover:bg-white border-2 border-dashed border-histo-copper/30 hover:border-histo-copper rounded-xl cursor-pointer transition-all shadow-xs group"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
          <div className="w-10 h-10 rounded-xl bg-histo-copper/10 group-hover:bg-histo-copper/20 flex items-center justify-center text-histo-copper shrink-0 transition-colors">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-histo-dark group-hover:text-histo-copper transition-colors">
              Attach PDFs, Docs, or Images to Synthesize
            </h4>
            <p className="font-ui text-xs text-histo-ink/60 mt-0.5">
              Supports PDF, Word (.docx), Markdown (.md), Text (.txt), and Images (PNG, JPG, WebP)
            </p>
          </div>
          <button
            type="button"
            className="sm:ml-auto px-3 py-1.5 bg-histo-copper text-white rounded-[4px] font-ui text-xs font-semibold hover:bg-histo-dark transition-colors shrink-0 cursor-pointer"
          >
            Browse Files
          </button>
        </div>
      </div>

      {/* Suggested Prompts Grid */}
      <div className="w-full max-w-2xl text-left">
        <span className="font-ui text-xs font-bold text-histo-ink/50 uppercase tracking-wider block mb-3 px-1">
          Suggested Study Prompts
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_PROMPTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                const prompt = s.prompt.replace('{topic}', 'French Revolution');
                onSelectPrompt(prompt);
              }}
              className="p-4 bg-white border border-histo-dark/10 rounded-[6px] hover:border-histo-copper hover:shadow-soft transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-ui text-[11px] font-bold text-histo-copper uppercase tracking-wider">
                  {s.label}
                </span>
                <span className="font-ui text-[10px] px-1.5 py-0.5 bg-histo-cream text-histo-dark/60 rounded">
                  {s.category}
                </span>
              </div>
              <p className="font-body text-xs text-histo-ink/70 line-clamp-2 leading-relaxed group-hover:text-histo-ink transition-colors">
                {s.prompt.replace('{topic}', 'French Revolution')}
              </p>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

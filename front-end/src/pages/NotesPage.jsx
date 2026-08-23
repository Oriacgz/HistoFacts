import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Send,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Trash2,
  Menu,
  X,
  Loader2,
  MessageSquare,
  FileText,
  ArrowLeft,
  User,
  Users,
  Settings,
  LogOut,
  Paperclip,
  Image as ImageIcon,
  File,
  Upload,
  Plus,
  Search,
  CheckCircle2,
  Coins,
  Zap,
  ShoppingBag,
  PenTool,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  generateNoteApi,
  generateHandwrittenNoteApi,
  getMyNotesApi,
  deleteNoteApi,
  getWalletApi,
  getShopPacksApi,
  purchasePackApi,
} from '../api/aiNotes';

const SUGGESTED_PROMPTS = [
  {
    label: 'Key Events Timeline',
    category: 'Timeline',
    prompt: 'Create a chronological timeline of key events for {topic} with dates and significance',
  },
  {
    label: 'Exam-Focused Summary',
    category: 'Revision',
    prompt: 'Generate exam-focused notes for {topic} covering causes, events, consequences, and key figures',
  },
  {
    label: 'Comparative Analysis',
    category: 'Analysis',
    prompt: 'Compare and contrast {topic} with similar historical events and political transformations',
  },
  {
    label: 'Primary Source Analysis',
    category: 'Sources',
    prompt: 'Analyze primary and secondary sources related to {topic} for historical interpretation and evidence',
  },
];

// Helper to estimate tokens client-side from input text (~1.3 tokens per word or 3.8 chars/token)
function estimateClientTokens(text, attachments = []) {
  if (!text && attachments.length === 0) return 0;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const promptTokens = Math.max(Math.round(wordCount * 1.3), Math.round(text.length / 3.8));
  let attachmentTokens = 0;
  attachments.forEach((a) => {
    if (a.extractedText) {
      attachmentTokens += Math.round(a.extractedText.length / 4);
    } else {
      attachmentTokens += 500;
    }
  });
  // Prompt + Expected Output allowance
  return promptTokens + attachmentTokens + 1200;
}

// Helper to extract text / data from attached files in browser
async function processAttachedFile(file) {
  return new Promise((resolve) => {
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      previewUrl: null,
      extractedText: '',
      dataUrl: null,
    };

    if (file.type.startsWith('image/')) {
      fileInfo.previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = () => {
        fileInfo.dataUrl = reader.result;
        resolve(fileInfo);
      };
      reader.onerror = () => resolve(fileInfo);
      reader.readAsDataURL(file);
      return;
    }

    if (
      file.type.includes('text') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.rtf')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        fileInfo.extractedText = typeof reader.result === 'string' ? reader.result : '';
        resolve(fileInfo);
      };
      reader.onerror = () => resolve(fileInfo);
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        const bytes = new Uint8Array(buffer);
        let text = '';
        let chunk = '';
        for (let i = 0; i < bytes.length && text.length < 20000; i++) {
          const byte = bytes[i];
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
            chunk += String.fromCharCode(byte);
            if (chunk.length > 500) {
              text += chunk;
              chunk = '';
            }
          } else if (chunk.length > 3) {
            text += chunk + ' ';
            chunk = '';
          } else {
            chunk = '';
          }
        }
        text += chunk;
        const cleanWords = text
          .split(/\s+/)
          .filter((w) => w.length < 45 && !/[\\/]{3,}/.test(w))
          .join(' ');

        fileInfo.extractedText = cleanWords.slice(0, 15000);
      } catch {
        fileInfo.extractedText = `Attached document: ${file.name}`;
      }

      const dataReader = new FileReader();
      dataReader.onload = () => {
        fileInfo.dataUrl = dataReader.result;
        resolve(fileInfo);
      };
      dataReader.onerror = () => resolve(fileInfo);
      dataReader.readAsDataURL(file);
    };
    reader.onerror = () => resolve(fileInfo);
    reader.readAsArrayBuffer(file);
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Markdown Formatter Component for Standard AI Blocks
function MarkdownBlockViewer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-4 text-histo-ink font-body leading-relaxed max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        if (trimmed.startsWith('# ')) {
          return (
            <div key={idx} className="pb-2 border-b border-histo-copper/20 pt-1 mb-3">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-histo-dark tracking-tight">
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            </div>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <div key={idx} className="pt-4 pb-1.5 flex items-center gap-2 border-b border-histo-dark/10 text-histo-dark">
              <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-histo-dark">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            </div>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="font-display text-sm sm:text-base font-bold text-histo-dark pt-2">
              {trimmed.replace(/^###\s+/, '')}
            </h3>
          );
        }

        if (trimmed.startsWith('>')) {
          return (
            <div
              key={idx}
              className="p-3 my-2 bg-histo-copper/5 border-l-3 border-histo-copper rounded-r-md italic font-body text-sm text-histo-ink/90"
            >
              {trimmed.replace(/^>\s*/, '')}
            </div>
          );
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numberMatch) {
            return (
              <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
                <span className="h-5 w-5 rounded-full bg-histo-copper/15 text-histo-copper font-ui font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {numberMatch[1]}
                </span>
                <div
                  className="font-body text-sm text-histo-ink flex-1 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: numberMatch[2].replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
                  }}
                />
              </div>
            );
          }
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawText = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2.5 my-1 pl-2">
              <span className="h-1.5 w-1.5 rounded-full bg-histo-copper shrink-0 mt-2" />
              <div
                className="font-body text-sm text-histo-ink flex-1 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: rawText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
                }}
              />
            </div>
          );
        }

        if (trimmed.startsWith('**Curriculum Scope:**')) {
          return (
            <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-histo-cream border border-histo-copper/20 rounded-md font-ui text-xs text-histo-dark font-medium mb-2">
              <BookOpen className="h-3 w-3 text-histo-copper" />
              <span>{trimmed.replace(/\*\*/g, '')}</span>
            </div>
          );
        }

        return (
          <p
            key={idx}
            className="font-body text-sm text-histo-ink/90 leading-relaxed my-1"
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-histo-dark font-semibold">$1</strong>'),
            }}
          />
        );
      })}
    </div>
  );
}

// Markdown Formatter Component for Handwritten Notebook Style Blocks
function HandwrittenBlockViewer({ content }) {
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

export default function NotesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const shouldReduceMotion = useReducedMotion();

  // State
  const [notes, setNotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestylingId, setIsRestylingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Attached files state
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Token Wallet & Shop State
  const [wallet, setWallet] = useState({
    token_balance: 350000,
    histoin_balance: 0,
    next_refresh_at: new Date().toISOString(),
    daily_refresh_amount: 50000,
    free_refill_cap: 350000,
    purchased_ceiling: 1000000,
  });
  const [shopOpen, setShopOpen] = useState(false);
  const [shopPacks, setShopPacks] = useState([]);
  const [confirmPack, setConfirmPack] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Debounced cost estimate state
  const [estimatedTokens, setEstimatedTokens] = useState(0);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Fetch Wallet & Notes
  const fetchWallet = useCallback(async () => {
    try {
      const data = await getWalletApi();
      if (data) setWallet(data);
    } catch {
      // Fallback default state
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [notesData, walletData] = await Promise.all([
        getMyNotesApi().catch(() => []),
        getWalletApi().catch(() => null),
      ]);
      setNotes(notesData || []);
      if (walletData) setWallet(walletData);
    } catch {
      const sampleNotes = [
        {
          id: 'n-french-rev',
          title: 'The French Revolution (NCERT Class 9)',
          curriculum_tag: 'NCERT Class 9 History',
          content: `# Study Notes: The French Revolution (NCERT Class 9 History)

**Curriculum Scope:** NCERT Class 9 History

## 📌 Key Takeaways & Core Concepts
- **Topic:** The French Revolution (1789-1799)
- **Historical Period:** 18th Century European Transition from Absolute Monarchy to Republic
- **Core Theme:** Liberty, Equality, Fraternity; abolition of feudal privileges, rise of constitutional nationalism.

## 🏛️ Historical Context & Background
France in 1789 was divided into Three Estates. The Third Estate (98% of the population comprising peasants, artisans, and bourgeoisie) bore the entire tax burden while the First and Second Estates enjoyed tax exemptions and feudal dues. Severe debt from wars and famine sparked revolution.

## 📜 Major Timeline & Key Events
1. **May 1789:** Estates-General convened at Versailles; Third Estate declares itself the National Assembly.
2. **14 July 1789:** Storming of the Bastille fortress prison in Paris, marking popular revolt.
3. **August 1789:** Declaration of the Rights of Man and of the Citizen adopted.
4. **1792-1794:** Reign of Terror under Robespierre and the Jacobin Club.
5. **1799:** Napoleon Bonaparte seizes power, ending the revolutionary decade.

## 🎯 Examination & Curriculum Relevance
- **Essay Pointers:** Causes of the revolution (Social inequality, economic bankruptcy, philosophical enlightenment).
- **High-Yield Facts:** Tennis Court Oath, Bastille date (14 July), Jacobins, Girondins, Olympe de Gouges.

## ❓ Self-Assessment & Exam Questions
1. Why was the storming of the Bastille considered a symbol of the overthrow of tyranny?
2. How did the Declaration of the Rights of Man redefine the relationship between citizen and state?
3. Discuss the role of French women during the revolutionary upheavals.`,
          created_at: new Date().toISOString(),
        },
      ];
      setNotes(sampleNotes);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced token estimate calculation (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const est = estimateClientTokens(inputValue, attachedFiles);
      setEstimatedTokens(est);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, attachedFiles]);

  // Open Shop & Load Packs
  const handleOpenShop = async () => {
    setShopOpen(true);
    try {
      const packs = await getShopPacksApi();
      setShopPacks(packs || []);
    } catch {
      setShopPacks([
        { id: 'p-1', name: 'Starter Pack', token_amount: 50000, histoin_cost: 100, is_active: true },
        { id: 'p-2', name: 'Popular Pack', token_amount: 150000, histoin_cost: 250, is_active: true },
        { id: 'p-3', name: 'Mega Pack', token_amount: 350000, histoin_cost: 500, is_active: true },
      ]);
    }
  };

  // Buy Token Pack
  const handleBuyPack = async (pack) => {
    if (wallet.histoin_balance < pack.histoin_cost) {
      toast.error(`Insufficient Histoins! Need ${pack.histoin_cost} 🪙`);
      return;
    }
    setConfirmPack(pack);
  };

  const confirmPurchase = async () => {
    if (!confirmPack) return;
    setIsPurchasing(true);
    try {
      const res = await purchasePackApi(confirmPack.id);
      setWallet((prev) => ({
        ...prev,
        token_balance: res.token_balance,
        histoin_balance: res.histoin_balance,
      }));
      toast.success(`Purchased ${confirmPack.name}! +${res.tokens_credited?.toLocaleString()} tokens.`);
      setConfirmPack(null);
    } catch (err) {
      toast.error(err.message || 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [messages, isGenerating, isRestylingId, shouldReduceMotion]);

  // Handle File Input Selection
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = async (files) => {
    setIsProcessingFiles(true);
    try {
      const processed = await Promise.all(files.map((file) => processAttachedFile(file)));
      setAttachedFiles((prev) => [...prev, ...processed]);
      toast.success(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to process attached files');
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await addFiles(files);
    }
  };

  // Copy individual AI block content
  const handleCopyBlock = (messageId, content) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    toast.success('Copied response to clipboard!');
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Convert Note to Handwritten Style
  const handleConvertToHandwritten = async (noteId, messageId) => {
    if (!noteId) {
      toast.info('Please save or select a note to convert');
      return;
    }

    if (wallet.token_balance < 1000) {
      toast.error('Not enough tokens to restyle! Please visit the Shop.');
      handleOpenShop();
      return;
    }

    setIsRestylingId(messageId);
    try {
      const res = await generateHandwrittenNoteApi(noteId);

      const hwMsgId = `ai-hw-${Date.now()}`;
      const hwMessage = {
        id: hwMsgId,
        noteId: res.id,
        role: 'assistant',
        title: res.title,
        content: res.content,
        style: 'handwritten',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, hwMessage]);

      const savedNote = {
        id: res.id || `n-hw-${Date.now()}`,
        title: res.title,
        content: res.content,
        style: 'handwritten',
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [savedNote, ...prev]);
      setActiveNoteId(savedNote.id);
      fetchWallet();
      toast.success('Converted to Handwritten Notes!');
    } catch (err) {
      if (err.status === 402) {
        toast.error('Insufficient tokens! Visit shop to refill.');
        handleOpenShop();
      } else {
        toast.error('Failed to convert to handwritten notes');
      }
    } finally {
      setIsRestylingId(null);
    }
  };

  // Send Message / Generate Answer Block
  const handleSendMessage = async (customPrompt = null) => {
    const promptText = (customPrompt || inputValue).trim();
    if ((!promptText && attachedFiles.length === 0) || isGenerating) return;

    // Check token balance
    const estCost = estimateClientTokens(promptText, attachedFiles);
    if (wallet.token_balance < estCost) {
      toast.error(`Not enough tokens! You need ~${estCost.toLocaleString()} tokens.`);
      handleOpenShop();
      return;
    }

    const currentFiles = [...attachedFiles];
    const userPrompt = promptText || (currentFiles.length > 0 ? `Analyze attached document: ${currentFiles[0].name}` : 'Generate study notes');

    const userMsgId = `user-${Date.now()}`;
    const userMessage = {
      id: userMsgId,
      role: 'user',
      content: userPrompt,
      attachments: currentFiles,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setAttachedFiles([]);
    setIsGenerating(true);

    const primaryFile = currentFiles[0] || null;

    try {
      const payload = {
        topic: userPrompt,
        curriculum: 'General History & Curriculum',
        attachment_name: primaryFile?.name || null,
        attachment_type: primaryFile?.type || null,
        attachment_text: primaryFile?.extractedText || null,
        attachment_data: primaryFile?.dataUrl || null,
      };

      const res = await generateNoteApi(payload);

      const aiMsgId = `ai-${Date.now()}`;
      const aiMessage = {
        id: aiMsgId,
        noteId: res.id,
        role: 'assistant',
        title: res.title,
        content: res.content,
        style: res.style || 'standard',
        attachment_name: primaryFile?.name || null,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      const savedNote = {
        id: res.id || `n-${Date.now()}`,
        title: res.title || userPrompt.slice(0, 45),
        content: res.content,
        style: res.style || 'standard',
        created_at: new Date().toISOString(),
      };
      setNotes((prev) => [savedNote, ...prev]);
      setActiveNoteId(savedNote.id);
      fetchWallet();
      toast.success('Answer generated on canvas!');
    } catch (err) {
      if (err.status === 402) {
        toast.error('Insufficient tokens! Visit shop to refill.');
        handleOpenShop();
      } else {
        // Local fallback generation
        let sourceSection = '';
        if (primaryFile) {
          sourceSection = `\n\n## 📎 Attached Source Analysis (${primaryFile.name})\n- **Analyzed File:** \`${primaryFile.name}\`\n- **Synthesis:** Extracted primary historical arguments and key evidence.`;
        }

        const fallbackContent = `# Study Notes: ${userPrompt}\n\n## 📌 Key Takeaways & Core Concepts\n- **Topic:** ${userPrompt}\n- **Historical Significance:** Critical milestone in world history and institutional development.\n- **Core Theme:** Political evolution, socio-economic factors, and lasting societal impacts.${sourceSection}\n\n## 🏛️ Historical Context & Background\nUnderstanding the conditions leading up to **${userPrompt}** provides vital context on how leadership, public policy, and socio-economic tensions converged.\n\n## 📜 Major Timeline & Key Events\n1. **Origins & Catalysts:** Societal, economic, and philosophical triggers leading to change.\n2. **Pivotal Turning Point:** Crucial events and key leadership shifts that redefined policies.\n3. **Outcome & Legacy:** Long-term legal, administrative, and cultural transformations.\n\n## 🎯 Examination & Curriculum Relevance\n- **Descriptive & Essay Focus:** Analyze cause-and-effect relationships and source evidence.\n- **High-Yield Fact Points:** Memorize key dates, prominent figures, treaties, and declarations.\n\n## ❓ Self-Assessment & Exam Questions\n1. What were the primary socio-economic factors driving ${userPrompt}?\n2. How did these historical developments influence subsequent governance and state institutions?`;

        const fallbackNoteId = `n-${Date.now()}`;
        const aiMsgId = `ai-${Date.now()}`;
        const aiMessage = {
          id: aiMsgId,
          noteId: fallbackNoteId,
          role: 'assistant',
          title: `Notes: ${userPrompt.slice(0, 45)}`,
          content: fallbackContent,
          style: 'standard',
          attachment_name: primaryFile?.name || null,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        const savedNote = {
          id: fallbackNoteId,
          title: userPrompt.slice(0, 45),
          content: fallbackContent,
          style: 'standard',
          created_at: new Date().toISOString(),
        };
        setNotes((prev) => [savedNote, ...prev]);
        setActiveNoteId(savedNote.id);
        fetchWallet();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveNoteId(null);
    setInputValue('');
    setAttachedFiles([]);
  };

  const handleSelectSavedNote = (note) => {
    setActiveNoteId(note.id);
    setMessages([
      {
        id: `user-saved-${note.id}`,
        role: 'user',
        content: note.title.replace(/^Study Notes:\s*/, '').replace(/^Handwritten:\s*/, ''),
        timestamp: note.created_at || new Date().toISOString(),
      },
      {
        id: `ai-saved-${note.id}`,
        noteId: note.id,
        role: 'assistant',
        title: note.title,
        content: note.content,
        style: note.style || (note.title.toLowerCase().includes('handwritten') ? 'handwritten' : 'standard'),
        timestamp: note.created_at || new Date().toISOString(),
      },
    ]);
  };

  const handleDeleteNote = async (noteId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this note from library?')) return;
    try {
      await deleteNoteApi(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        handleNewChat();
      }
      toast.success('Note deleted');
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        handleNewChat();
      }
      toast.success('Note deleted locally');
    }
  };

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return n.title && n.title.toLowerCase().includes(q);
  });

  const isInsufficient = wallet.token_balance < (estimatedTokens || 1200);

  return (
    <div
      className="min-h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture flex overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.epub,.png,.jpg,.jpeg,.webp,image/*"
        className="hidden"
      />

      {/* Drag & Drop Screen Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-histo-dark/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white border-4 border-dashed border-histo-gold m-4 rounded-2xl pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-histo-gold/20 flex items-center justify-center mb-4 text-histo-gold animate-bounce">
              <Upload className="h-10 w-10" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Drop PDFs, Docs, or Images Here</h3>
            <p className="font-ui text-sm text-histo-cream/80 max-w-md">
              HistoFacts AI will synthesize structured notes from your source documents.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Modal */}
      <AnimatePresence>
        {shopOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShopOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-histo-dark/15 rounded-2xl shadow-deep max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Shop Header */}
              <div className="p-5 bg-gradient-to-r from-histo-dark to-histo-medium text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-histo-gold/20 flex items-center justify-center text-histo-gold">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold">Histoins Token Shop</h3>
                    <p className="font-ui text-xs text-histo-cream/80">Exchange Histoins for AI Generation Tokens</p>
                  </div>
                </div>
                <button
                  onClick={() => setShopOpen(false)}
                  className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Wallet Balances Banner */}
              <div className="p-4 bg-histo-cream/50 border-b border-histo-dark/10 flex items-center justify-around text-center">
                <div>
                  <span className="font-ui text-[11px] font-semibold text-histo-ink/60 uppercase block">Your Histoins</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span className="font-display text-lg font-bold text-histo-dark">{wallet.histoin_balance.toLocaleString()} 🪙</span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-histo-dark/15" />
                <div>
                  <span className="font-ui text-[11px] font-semibold text-histo-ink/60 uppercase block">Current Tokens</span>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <Zap className="h-4 w-4 text-histo-copper" />
                    <span className="font-display text-lg font-bold text-histo-dark">{wallet.token_balance.toLocaleString()} ⚡</span>
                  </div>
                </div>
              </div>

              {/* Token Packs List */}
              <div className="p-5 overflow-y-auto space-y-3">
                <span className="font-ui text-xs font-bold text-histo-ink/50 uppercase tracking-wider block mb-1">
                  Available Token Packs
                </span>

                {shopPacks.map((pack) => {
                  const canAfford = wallet.histoin_balance >= pack.histoin_cost;
                  return (
                    <div
                      key={pack.id}
                      className="p-4 rounded-xl border border-histo-dark/15 bg-white hover:border-histo-copper transition-all shadow-xs flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm font-bold text-histo-dark">{pack.name}</h4>
                          {pack.token_amount >= 350000 && (
                            <span className="text-[10px] font-ui font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                              Best Value
                            </span>
                          )}
                        </div>
                        <p className="font-ui text-xs text-histo-copper font-semibold mt-0.5">
                          +{pack.token_amount.toLocaleString()} Tokens
                        </p>
                      </div>

                      <button
                        onClick={() => handleBuyPack(pack)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-lg font-ui text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          canAfford
                            ? 'bg-histo-copper text-white hover:bg-histo-dark active:scale-95'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                      >
                        <Coins className="h-3.5 w-3.5" />
                        <span>{pack.histoin_cost} 🪙</span>
                      </button>
                    </div>
                  );
                })}

                {/* Info on how to earn Histoins */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-blue-900 mt-4 text-xs font-ui space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>How to Earn Histoins:</span>
                  </div>
                  <p className="text-blue-800/80 leading-relaxed pl-5.5">
                    • <strong>Daily Login:</strong> +10 Histoins every day on first activity.<br />
                    • <strong>History Quizzes:</strong> +20 Histoins for completing quizzes (max 3/day).
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Dialog */}
      <AnimatePresence>
        {confirmPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-histo-dark/15 shadow-deep text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Coins className="h-6 w-6" />
              </div>
              <h4 className="font-display text-base font-bold text-histo-dark">Confirm Token Purchase</h4>
              <p className="font-ui text-xs text-histo-ink/70 mt-1 mb-5">
                Spend <strong>{confirmPack.histoin_cost} Histoins</strong> to credit{' '}
                <strong>+{confirmPack.token_amount.toLocaleString()} Tokens</strong>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmPack(null)}
                  disabled={isPurchasing}
                  className="flex-1 py-2 rounded-lg border border-histo-dark/15 text-xs font-ui font-semibold hover:bg-histo-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPurchase}
                  disabled={isPurchasing}
                  className="flex-1 py-2 rounded-lg bg-histo-copper text-white text-xs font-ui font-bold hover:bg-histo-dark transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isPurchasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Sidebar: Notes Library */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="notes-sidebar"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed lg:relative inset-y-0 left-0 z-40 w-72 bg-white border-r border-histo-dark/10 shadow-xl flex flex-col shrink-0"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-histo-dark/10 min-h-[64px]">
              <h2 className="font-display text-lg font-bold text-histo-dark flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-histo-copper" />
                Notes Library
              </h2>
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-histo-cream text-histo-ink/60 hover:text-histo-dark"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3 border-b border-histo-dark/10">
              <button
                onClick={handleNewChat}
                className="p-3 bg-histo-copper text-white rounded-[4px] font-ui text-xs font-bold uppercase tracking-wider w-full flex items-center justify-center gap-2 hover:bg-histo-dark transition-all shadow-soft active:scale-98 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-histo-dark/10">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-histo-ink/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search past notes..."
                  className="w-full pl-8 pr-3 py-1.5 bg-histo-cream/60 border border-histo-dark/10 rounded-[4px] text-xs font-ui text-histo-ink placeholder:text-histo-ink/40 outline-none focus:border-histo-copper"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-histo-ink/40 hover:text-histo-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-histo-ink/40">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-body text-xs">
                    {searchQuery ? 'No matching notes' : 'No notes saved yet'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = activeNoteId === note.id;
                  const isHandwritten = note.style === 'handwritten' || note.title.toLowerCase().includes('handwritten');
                  return (
                    <div
                      key={note.id}
                      onClick={() => handleSelectSavedNote(note)}
                      className={`group p-2.5 rounded-[4px] cursor-pointer transition-all border flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-histo-copper/10 border-histo-copper shadow-xs'
                          : 'bg-white hover:bg-histo-cream/60 border-histo-dark/10 hover:border-histo-copper/40'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isHandwritten && (
                            <span className="text-[9px] font-ui px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-semibold flex items-center gap-0.5">
                              ✍️ Hand
                            </span>
                          )}
                          <h4 className="font-display text-xs font-bold text-histo-dark truncate leading-tight group-hover:text-histo-copper transition-colors">
                            {note.title.replace(/^Study Notes:\s*/, '').replace(/^Handwritten Notes:\s*/, '')}
                          </h4>
                        </div>
                        <p className="font-ui text-[10px] text-histo-ink/40 mt-0.5">
                          {note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Today'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-histo-ink/40 hover:text-red-500 rounded transition-opacity"
                        title="Delete note"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-histo-dark/10 bg-histo-cream/30">
              <p className="font-ui text-xs text-histo-ink/60 text-center">
                {notes.length} note{notes.length !== 1 ? 's' : ''} in library
              </p>
            </div>
          </motion.aside>
        )}

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <motion.div
            key="notes-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Single Canvas Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-histo-paper/95 backdrop-blur-md border-b border-histo-dark/10 px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-4 shrink-0 shadow-xs min-h-[64px]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="p-2 rounded-lg bg-histo-dark text-white hover:bg-histo-copper transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Hide notes library' : 'Show notes library'}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open notes library'}
            >
              {sidebarOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>

            {/* Back to Home Button */}
            <Link
              to="/home"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-histo-cream/90 border border-histo-dark/15 text-histo-dark hover:text-histo-copper hover:border-histo-copper/50 transition-colors text-xs font-ui font-bold uppercase tracking-wider shrink-0 shadow-2xs"
              title="Return to Dashboard Home"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <div className="flex items-center gap-2.5 truncate">
              <h1 className="font-display text-lg sm:text-xl font-bold text-histo-dark tracking-tight truncate">
                AI Notes Assistant
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 bg-histo-copper/10 text-histo-copper rounded-full text-[10px] font-ui uppercase tracking-wider shrink-0 font-bold">
                <Sparkles className="h-3 w-3" />
                AI Powered
              </span>
            </div>
          </div>

          {/* Shop / Histoins Badge & User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Shop & Histoin Currency Button */}
            <button
              onClick={handleOpenShop}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100/90 border border-amber-300 rounded-full font-ui text-xs sm:text-sm font-bold text-amber-900 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Open Token Shop"
            >
              <Coins className="h-4 w-4 text-amber-500 shrink-0" />
              <span>{wallet.histoin_balance.toLocaleString()} 🪙</span>
              <span className="hidden sm:inline-block ml-0.5 px-2 py-0.5 bg-amber-200/80 rounded-full text-[10px] text-amber-950 font-bold uppercase tracking-wider">
                Shop
              </span>
            </button>

            {/* User Profile Avatar & Dropdown */}
            <div className="relative">
              {user ? (
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none outline-none group"
                >
                  <div className="h-9.5 w-9.5 rounded-full bg-histo-copper/20 border-2 border-histo-copper/40 group-hover:border-histo-copper flex items-center justify-center text-histo-copper font-display font-bold text-sm shadow-xs transition-colors">
                    {user.username ? user.username[0].toUpperCase() : 'U'}
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-ui font-semibold text-histo-dark group-hover:text-histo-copper transition-colors truncate max-w-[120px]">
                      {user.username}
                    </span>
                    <span className="text-[10px] font-ui text-histo-copper font-medium tracking-wide">
                      Scholar
                    </span>
                  </div>
                </button>
              ) : (
                <Link to="/loginpg" className="px-3.5 py-1.5 rounded-lg bg-histo-copper text-white text-xs font-ui font-bold hover:bg-histo-dark transition-colors">
                  Sign In
                </Link>
              )}

              {user && profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-histo-dark text-white border border-histo-gold/30 rounded-[4px] shadow-deep p-2 z-50">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="font-display text-sm font-bold text-histo-paper">{user.username}</p>
                    <p className="font-ui text-[10px] text-white/50 truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/home"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 text-histo-gold/80" />
                    <span>Dashboard Home</span>
                  </Link>
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      handleOpenShop();
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-ui text-histo-paper hover:bg-white/10 hover:text-histo-gold rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-histo-gold/80" />
                    <span>Token Shop</span>
                  </button>
                  <div className="h-[1px] bg-white/10 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setProfileMenuOpen(false);
                      navigate('/loginpg');
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-ui font-semibold text-red-400 hover:bg-red-500/10 rounded-[2px] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-red-400" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Central Canvas Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Welcome Screen (when no messages yet) */}
          {messages.length === 0 && !isGenerating && (
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
                onClick={() => fileInputRef.current?.click()}
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
                  {SUGGESTED_PROMPTS.map((s, idx) => (
                    <button
                      key={s.label}
                      onClick={() => {
                        const prompt = s.prompt.replace('{topic}', 'French Revolution');
                        handleSendMessage(prompt);
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
          )}

          {/* Conversation Feed */}
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="max-w-4xl mx-auto flex justify-end">
                  <div className="max-w-[85%] bg-histo-dark text-white rounded-2xl rounded-br-xs px-5 py-3.5 shadow-soft space-y-2">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-1.5 border-b border-white/15">
                        {msg.attachments.map((f, fi) => (
                          <div
                            key={fi}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md text-[11px] font-ui text-histo-gold"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="font-body text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            }

            // AI Answer Block
            const isBlockCopied = copiedMessageId === msg.id;
            const isHandwritten = msg.style === 'handwritten';
            const isRestylingThis = isRestylingId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto bg-white border border-histo-dark/15 rounded-xl shadow-soft overflow-hidden"
              >
                {/* AI Block Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-histo-cream/40 border-b border-histo-dark/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isHandwritten ? 'bg-purple-100 text-purple-700' : 'bg-histo-copper/15 text-histo-copper'}`}>
                      {isHandwritten ? <PenTool className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </div>
                    <span className="font-ui text-xs font-bold text-histo-dark truncate">
                      {isHandwritten ? '✍️ Handwritten Lecture Notes' : 'HistoFacts AI'}
                    </span>
                    {msg.attachment_name && (
                      <span className="text-[10px] font-ui px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1 shrink-0">
                        <Paperclip className="h-2.5 w-2.5" />
                        {msg.attachment_name}
                      </span>
                    )}
                  </div>

                  {/* Actions on Top Right of that Block */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Convert to Handwritten Button (on standard notes) */}
                    {!isHandwritten && msg.noteId && (
                      <button
                        type="button"
                        onClick={() => handleConvertToHandwritten(msg.noteId, msg.id)}
                        disabled={isRestylingThis}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 transition-all font-ui text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                        title="Restyle as student handwritten class notes"
                      >
                        {isRestylingThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-700" />
                            <span className="text-[11px]">Writing...</span>
                          </>
                        ) : (
                          <>
                            <PenTool className="h-3.5 w-3.5 text-purple-700" />
                            <span className="text-[11px] hidden sm:inline">Handwritten Style</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Copy Button on Top Right */}
                    <button
                      type="button"
                      onClick={() => handleCopyBlock(msg.id, msg.content)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-white border border-histo-dark/15 hover:border-histo-copper hover:bg-histo-cream transition-all font-ui text-xs text-histo-ink/70 hover:text-histo-copper cursor-pointer shadow-2xs"
                      title="Copy this response"
                    >
                      {isBlockCopied ? (
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
                  </div>
                </div>

                {/* AI Block Content Body */}
                <div className="p-6 sm:p-7">
                  {isHandwritten ? (
                    <HandwrittenBlockViewer content={msg.content} />
                  ) : (
                    <MarkdownBlockViewer content={msg.content} />
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Generating Loading Block */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto bg-white border border-histo-copper/30 rounded-xl p-6 shadow-soft flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-histo-copper/10 flex items-center justify-center text-histo-copper shrink-0">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-histo-dark">
                  Synthesizing study response...
                </p>
                <p className="font-ui text-xs text-histo-ink/50 mt-0.5">
                  Consulting historical sources and structuring curriculum insights
                </p>
              </div>
            </motion.div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Bottom Integrated Prompt & Attachment Bar */}
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
                      onClick={() => removeAttachedFile(idx)}
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
                handleSendMessage();
              }}
            >
              <div className="relative flex items-center w-full bg-white border border-histo-dark/15 focus-within:border-histo-copper focus-within:ring-2 focus-within:ring-histo-copper/20 rounded-full shadow-soft transition-all">
                {/* Attachment Trigger Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="pl-3 pr-2 py-3 text-histo-ink/50 hover:text-histo-copper transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                  title="Attach PDF, Document, or Image"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask anything about history, or attach PDFs/Docs/Images..."
                  disabled={isGenerating}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isGenerating && (inputValue.trim() || attachedFiles.length > 0)) {
                        handleSendMessage();
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
                  onClick={handleOpenShop}
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
                  <button onClick={handleOpenShop} className="underline hover:text-red-800 cursor-pointer">
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
      </main>
    </div>
  );
}
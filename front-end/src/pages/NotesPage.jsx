import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Upload,
  Loader2,
  Paperclip,
  PenTool,
  Sparkles,
  CheckCircle2,
  Copy,
  Wand2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  generateNoteApi,
  generateHandwrittenNoteApi,
  reviseNoteApi,
  getMyNotesApi,
  deleteNoteApi,
  getWalletApi,
  getShopPacksApi,
  purchasePackApi,
} from '../api/aiNotes';

// Modular feature imports
import { estimateClientTokens } from '../features/ai-notes/utils/tokenEstimator';
import { processAttachedFile } from '../features/ai-notes/utils/fileProcessor';
import MarkdownBlockViewer from '../features/ai-notes/components/MarkdownBlockViewer';
import HandwrittenBlockViewer from '../features/ai-notes/components/HandwrittenBlockViewer';
import ShopModal from '../features/ai-notes/components/ShopModal';
import NotesSidebar from '../features/ai-notes/components/NotesSidebar';
import NotesHeader from '../features/ai-notes/components/NotesHeader';
import WelcomeCanvas from '../features/ai-notes/components/WelcomeCanvas';
import PromptInputArea from '../features/ai-notes/components/PromptInputArea';

export default function NotesPage() {
  const { user, logout } = useAuth();
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

  // "Refine with AI" panel state
  const [refineOpenId, setRefineOpenId] = useState(null);   // message id whose panel is expanded
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

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
      // Keep default state
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
      setNotes([]);
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
    // Generate idempotency key once per purchase attempt
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setConfirmPack({ ...pack, idempotencyKey });
  };

  const confirmPurchase = async () => {
    if (!confirmPack) return;
    setIsPurchasing(true);
    try {
      const res = await purchasePackApi(confirmPack.id, confirmPack.idempotencyKey);
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
      } else if (err.status === 400) {
        // Guardrail refusal — show as a friendly assistant bubble, not an error toast
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-refusal-${Date.now()}`,
            role: 'assistant',
            isRefusal: true,
            content: err.message || "I can only help with history topics. Try asking about a historical event, figure, or period!",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        toast.error(err.message || 'Failed to generate note. Please try again.');
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

  const handleRefineNote = async (msg) => {
    const instruction = refineInput.trim();
    if (!instruction || isRefining) return;

    if (wallet.token_balance < 1000) {
      toast.error('Not enough tokens to refine! Please visit the Shop.');
      handleOpenShop();
      return;
    }

    setIsRefining(true);
    try {
      const res = await reviseNoteApi(msg.noteId, instruction);

      // Add the user's instruction bubble
      const userMsgId = `user-refine-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          content: `Refine: ${instruction}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Add the revised note as a new AI block
      const refinedMsgId = `ai-refined-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: refinedMsgId,
          noteId: res.id,
          role: 'assistant',
          title: res.title,
          content: res.content,
          style: res.style || 'standard',
          timestamp: new Date().toISOString(),
        },
      ]);

      // Prepend revised note to library; original is untouched
      setNotes((prev) => [
        {
          id: res.id,
          title: res.title,
          content: res.content,
          style: res.style || 'standard',
          source_note_id: res.source_note_id,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setActiveNoteId(res.id);

      setRefineOpenId(null);
      setRefineInput('');
      fetchWallet();
      toast.success('Note refined! Original preserved in library.');
    } catch (err) {
      if (err.status === 402) {
        toast.error('Insufficient tokens! Visit shop to refill.');
        handleOpenShop();
      } else {
        toast.error(err.message || 'Failed to refine note. Please try again.');
      }
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div
      className="h-screen bg-histo-paper text-histo-ink font-body histo-paper-texture flex flex-col overflow-hidden"
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
      <ShopModal
        isOpen={shopOpen}
        onClose={() => setShopOpen(false)}
        wallet={wallet}
        shopPacks={shopPacks}
        onBuyPack={handleBuyPack}
        confirmPack={confirmPack}
        onConfirmPurchase={confirmPurchase}
        onCancelConfirm={() => setConfirmPack(null)}
        isPurchasing={isPurchasing}
      />

      {/* Persistent Full-Width Top Header Bar */}
      <NotesHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        wallet={wallet}
        onOpenShop={handleOpenShop}
        user={user}
        profileMenuOpen={profileMenuOpen}
        onToggleProfileMenu={() => setProfileMenuOpen(!profileMenuOpen)}
        onCloseProfileMenu={() => setProfileMenuOpen(false)}
        logout={logout}
      />

      {/* Content Area Below Header */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Notes Library */}
        <NotesSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          notes={notes}
          activeNoteId={activeNoteId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewChat={handleNewChat}
          onSelectNote={handleSelectSavedNote}
          onDeleteNote={handleDeleteNote}
        />

        {/* Main Single Canvas Workspace */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Central Canvas Stream */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">

          {/* Welcome Screen (when no messages yet) */}
          {messages.length === 0 && !isGenerating && (
            <WelcomeCanvas
              onSelectPrompt={handleSendMessage}
              onTriggerFileInput={() => fileInputRef.current?.click()}
            />
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
                    {/* Convert to Handwritten Button */}
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

                    {/* Refine with AI toggle button */}
                    {msg.noteId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (refineOpenId === msg.id) {
                            setRefineOpenId(null);
                            setRefineInput('');
                          } else {
                            setRefineOpenId(msg.id);
                            setRefineInput('');
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 transition-all font-ui text-xs font-semibold cursor-pointer shadow-2xs active:scale-95"
                        title="Refine this note with a plain-language instruction"
                      >
                        <Wand2 className="h-3.5 w-3.5 text-amber-700" />
                        <span className="text-[11px] hidden sm:inline">Refine with AI</span>
                        {refineOpenId === msg.id
                          ? <ChevronUp className="h-3 w-3 text-amber-600" />
                          : <ChevronDown className="h-3 w-3 text-amber-600" />}
                      </button>
                    )}

                    {/* Copy Button */}
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

                {/* Refine with AI expandable panel */}
                <AnimatePresence>
                  {refineOpenId === msg.id && (
                    <motion.div
                      key={`refine-panel-${msg.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-amber-100 bg-amber-50/60"
                    >
                      <div className="px-6 py-4 space-y-2">
                        <p className="font-ui text-[11px] text-amber-800/80 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <Wand2 className="h-3 w-3" />
                          Describe the change you want
                        </p>
                        <div className="flex gap-2">
                          <textarea
                            id={`refine-input-${msg.id}`}
                            value={refineInput}
                            onChange={(e) => setRefineInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleRefineNote(msg);
                              }
                            }}
                            placeholder="e.g. Focus on economic causes, add more dates, simplify for a younger audience…"
                            rows={2}
                            disabled={isRefining}
                            className="flex-1 resize-none px-3 py-2 text-sm font-body text-histo-ink bg-white border border-amber-200 rounded-lg outline-none focus:border-amber-400 placeholder:text-histo-ink/40 disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => handleRefineNote(msg)}
                            disabled={isRefining || !refineInput.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-ui text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed self-start mt-0.5"
                          >
                            {isRefining ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Refining…</span></>
                            ) : (
                              <><Wand2 className="h-3.5 w-3.5" /><span>Refine</span></>
                            )}
                          </button>
                        </div>
                        <p className="font-ui text-[10px] text-amber-700/60">
                          Original note is preserved · revised copy appears in your library · ⌘Enter to submit
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
        <PromptInputArea
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          attachedFiles={attachedFiles}
          onRemoveAttachment={removeAttachedFile}
          isProcessingFiles={isProcessingFiles}
          onTriggerFileInput={() => fileInputRef.current?.click()}
          wallet={wallet}
          estimatedTokens={estimatedTokens}
          onOpenShop={handleOpenShop}
        />
      </main>
      </div>
    </div>
  );
}
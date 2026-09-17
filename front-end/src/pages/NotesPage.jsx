import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  generateHandwrittenNoteApi,
  getMyNotesApi,
  deleteNoteApi,
  getWalletApi,
  getShopPacksApi,
  purchasePackApi,
  getNoteThreadApi,
  streamGenerateNoteApi,
  streamContinueConversationApi,
} from '../api/aiNotes';

// Modular feature imports
import { estimateClientTokens } from '../features/ai-notes/utils/tokenEstimator';
import { processAttachedFile } from '../features/ai-notes/utils/fileProcessor';
import ShopModal from '../features/ai-notes/components/ShopModal';
import NotesSidebar from '../features/ai-notes/components/NotesSidebar';
import NotesHeader from '../features/ai-notes/components/NotesHeader';
import WelcomeCanvas from '../features/ai-notes/components/WelcomeCanvas';
import PromptInputArea from '../features/ai-notes/components/PromptInputArea';
import NoteThread from '../features/ai-notes/components/NoteThread';
import SharePickerModal from '../features/chat/SharePickerModal';

export default function NotesPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedNoteId = searchParams.get('note');

  // Fresh state on every load: activeNoteId is always null on mount (never auto-selected, never restored)
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeThread, setActiveThread] = useState([]);

  // Sidebar library (root sessions only)
  const [notes, setNotes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Composer & Streaming State
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState('');
  const [streamingAttachments, setStreamingAttachments] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [isRestylingId, setIsRestylingId] = useState(null);
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [shareNoteId, setShareNoteId] = useState(null);

  // Attached files state
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  // User Profile Menu State
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Debounced token estimate calculation
  const [estimatedTokens, setEstimatedTokens] = useState(0);

  const fileInputRef = useRef(null);

  // Fetch Wallet
  const fetchWallet = useCallback(async () => {
    try {
      const data = await getWalletApi();
      if (data) setWallet(data);
    } catch {
      // Keep default wallet state
    }
  }, []);

  // Initial Data Load: Load root notes and wallet info
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
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

  // Copy note content
  const handleCopyNote = (note) => {
    if (!note?.content) return;
    navigator.clipboard.writeText(note.content);
    setCopiedNoteId(note.id);
    toast.success('Copied note to clipboard!');
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  // Convert Note to Handwritten Style (adds to chain, never clutters sidebar)
  const handleConvertToHandwritten = async (noteId) => {
    if (!noteId) return;

    if (wallet.token_balance < 1000) {
      toast.error('Not enough tokens to restyle! Please visit the Shop.');
      handleOpenShop();
      return;
    }

    setIsRestylingId(noteId);
    try {
      const res = await generateHandwrittenNoteApi(noteId);
      // Append the handwritten version as a turn in the active thread
      setActiveThread((prev) => [...prev, res]);
      fetchWallet();
      toast.success('Converted to Handwritten Notes!');
    } catch (err) {
      if (err.status === 402) {
        toast.error('Insufficient tokens! Visit shop to refill.');
        handleOpenShop();
      } else {
        toast.error(err.message || 'Failed to convert note');
      }
    } finally {
      setIsRestylingId(null);
    }
  };

  // Start new session or send follow-up message in active thread
  const handleSendMessage = async (customPrompt = null) => {
    const promptText = (customPrompt || inputValue).trim();
    if ((!promptText && attachedFiles.length === 0) || isStreaming) return;

    // Check token balance
    const estCost = estimateClientTokens(promptText, attachedFiles);
    if (wallet.token_balance < estCost) {
      toast.error(`Not enough tokens! You need ~${estCost.toLocaleString()} tokens.`);
      handleOpenShop();
      return;
    }

    const currentFiles = [...attachedFiles];
    const userPrompt =
      promptText ||
      (currentFiles.length > 0
        ? `Analyze attached document: ${currentFiles[0].name}`
        : 'Generate historical study notes');
    const primaryFile = currentFiles[0] || null;

    // Clear composer input immediately
    setInputValue('');
    setAttachedFiles([]);

    // Set streaming state
    setIsStreaming(true);
    setStreamingPrompt(userPrompt);
    setStreamingAttachments(currentFiles);
    setStreamingText('');

    if (!activeNoteId) {
      // ── New Session Generation ─────────────────────────────
      const payload = {
        topic: userPrompt,
        curriculum: 'NCERT Class 10 History',
        attachment_name: primaryFile?.name || null,
        attachment_type: primaryFile?.type || null,
        attachment_text: primaryFile?.extractedText || null,
        attachment_data: primaryFile?.dataUrl || null,
      };

      try {
        await streamGenerateNoteApi({
          payload,
          onDelta: (delta) => {
            setStreamingText((prev) => prev + delta);
          },
          onNoteSaved: (savedNote) => {
            setNotes((prev) => [savedNote, ...prev]);
            setActiveNoteId(savedNote.id);
            setActiveThread([savedNote]);
            fetchWallet();
          },
        });
      } catch (err) {
        if (err.status === 402) {
          toast.error('Insufficient tokens! Visit shop to refill.');
          handleOpenShop();
        } else {
          toast.error(err.message || 'Failed to generate note');
        }
      } finally {
        setIsStreaming(false);
        setStreamingPrompt('');
        setStreamingAttachments([]);
        setStreamingText('');
      }
    } else {
      // ── Follow-up Turn in Existing Session Thread ───────────
      const payload = {
        message: userPrompt,
        attachment_name: primaryFile?.name || null,
        attachment_type: primaryFile?.type || null,
        attachment_text: primaryFile?.extractedText || null,
        attachment_data: primaryFile?.dataUrl || null,
      };

      try {
        await streamContinueConversationApi({
          noteId: activeNoteId,
          payload,
          onDelta: (delta) => {
            setStreamingText((prev) => prev + delta);
          },
          onNoteSaved: (newTurn) => {
            setActiveThread((prev) => [...prev, newTurn]);
            fetchWallet();
          },
        });
      } catch (err) {
        if (err.status === 402) {
          toast.error('Insufficient tokens! Visit shop to refill.');
          handleOpenShop();
        } else {
          toast.error(err.message || 'Failed to continue conversation');
        }
      } finally {
        setIsStreaming(false);
        setStreamingPrompt('');
        setStreamingAttachments([]);
        setStreamingText('');
      }
    }
  };

  // Start fresh chat / clear canvas
  const handleNewChat = () => {
    setActiveNoteId(null);
    setActiveThread([]);
    setInputValue('');
    setAttachedFiles([]);
    setStreamingText('');
    setStreamingPrompt('');
  };

  // Select session from sidebar: loads full thread
  const handleSelectSavedNote = async (note) => {
    setActiveNoteId(note.id);
    try {
      const thread = await getNoteThreadApi(note.id);
      setActiveThread(thread || [note]);
    } catch {
      setActiveThread([note]);
    }
  };

  useEffect(() => {
    if (!sharedNoteId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const thread = await getNoteThreadApi(sharedNoteId);
        if (cancelled) return;
        setActiveNoteId(thread?.[0]?.id || sharedNoteId);
        setActiveThread(thread || []);
      } catch {
        if (!cancelled) {
          setActiveNoteId(null);
          setActiveThread([]);
          toast.error('This shared note is unavailable.');
        }
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sharedNoteId, setSearchParams, toast]);

  // Delete session from sidebar
  const handleDeleteNote = async (noteId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation session from your library?')) return;
    try {
      await deleteNoteApi(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        handleNewChat();
      }
      toast.success('Session deleted');
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        handleNewChat();
      }
      toast.success('Session deleted locally');
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
        {/* Left Sidebar: Notes Library (Shows root sessions only) */}
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
          {/* Central Conversation Canvas */}
          <div className="flex-1 overflow-y-auto">
            {!activeNoteId && !isStreaming ? (
              <div className="px-4 sm:px-8 py-6">
                <WelcomeCanvas
                  onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                  onTriggerFileInput={() => fileInputRef.current?.click()}
                />
              </div>
            ) : (
              <NoteThread
                chain={activeThread}
                isStreaming={isStreaming}
                streamingPrompt={streamingPrompt}
                streamingText={streamingText}
                streamingAttachments={streamingAttachments}
                onConvertToHandwritten={handleConvertToHandwritten}
                isRestylingId={isRestylingId}
                onCopyNote={handleCopyNote}
                copiedNoteId={copiedNoteId}
                onShare={(note) => setShareNoteId(note.id)}
              />
            )}
          </div>

          {/* Share Picker Modal */}
          {shareNoteId && (
            <SharePickerModal
              noteId={shareNoteId}
              onClose={() => setShareNoteId(null)}
            />
          )}

          {/* Bottom Persistent Chat Composer */}
          <PromptInputArea
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSendMessage={handleSendMessage}
            isGenerating={isStreaming}
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
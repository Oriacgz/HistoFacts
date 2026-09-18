import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAiNotes } from '../contexts/AiNotesContext';
import {
  getShopPacksApi,
  purchasePackApi,
  getNoteThreadApi,
} from '../api/aiNotes';

// Modular feature imports
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

  // Shared persistent AI Notes context
  const {
    notes,
    activeNoteId,
    setActiveNoteId,
    activeThread,
    setActiveThread,
    inputValue,
    setInputValue,
    attachedFiles,
    addFiles,
    removeAttachedFile,
    isProcessingFiles,
    thinkEnabled,
    setThinkEnabled,
    isStreaming,
    streamingPrompt,
    streamingAttachments,
    streamingText,
    wallet,
    setWallet,
    isInsufficient,
    isRestylingId,
    handleSendMessage,
    handleStopGenerating,
    handleNewChat,
    handleSelectSavedNote,
    handleDeleteNote,
    handleConvertToHandwritten,
  } = useAiNotes();

  // Local Page Layout & Modal State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNoteId, setCopiedNoteId] = useState(null);
  const [shareNoteId, setShareNoteId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Shop Modal State
  const [shopOpen, setShopOpen] = useState(false);
  const [shopPacks, setShopPacks] = useState([]);
  const [confirmPack, setConfirmPack] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // User Profile Menu State
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Handle Shared Note URL parameter
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
  }, [sharedNoteId, setSearchParams, toast, setActiveNoteId, setActiveThread]);

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
          <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
            {activeThread.length === 0 && !isStreaming ? (
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
                scrollContainerRef={scrollContainerRef}
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
            onStopGenerating={handleStopGenerating}
            attachedFiles={attachedFiles}
            onRemoveAttachment={removeAttachedFile}
            isProcessingFiles={isProcessingFiles}
            onTriggerFileInput={() => fileInputRef.current?.click()}
            isInsufficient={isInsufficient}
            thinkEnabled={thinkEnabled}
            onToggleThink={() => setThinkEnabled((v) => !v)}
            wallet={wallet}
            streamingPrompt={streamingPrompt}
            streamingText={streamingText}
            streamingAttachments={streamingAttachments}
            onOpenShop={handleOpenShop}
          />
        </main>
      </div>
    </div>
  );
}
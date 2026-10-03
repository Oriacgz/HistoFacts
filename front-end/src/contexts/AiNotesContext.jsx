/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  getMyNotesApi,
  deleteNoteApi,
  getWalletApi,
  getShopPacksApi,
  purchasePackApi,
  getNoteThreadApi,
  streamGenerateNoteApi,
  streamContinueConversationApi,
  generateHandwrittenNoteApi,
} from '../api/aiNotes';
import { estimateClientTokens } from '../features/ai-notes/utils/tokenEstimator';
import { processAttachedFile } from '../features/ai-notes/utils/fileProcessor';

const AiNotesContext = createContext(null);

const DEFAULT_WALLET = {
  token_balance: 350000,
  histoin_balance: 0,
  next_refresh_at: new Date().toISOString(),
  daily_refresh_amount: 50000,
  free_refill_cap: 350000,
  purchased_ceiling: 1000000,
};

function getWalletStorageKey(userId) {
  return userId ? `histofacts_wallet_${userId}` : 'histofacts_wallet_guest';
}

function getActiveNoteStorageKey(userId) {
  return userId ? `histofacts_active_note_id_${userId}` : 'histofacts_active_note_id_guest';
}

function getDraftStorageKey(userId, noteId) {
  const sessionKey = noteId || 'new';
  return userId
    ? `histofacts_draft_${userId}_${sessionKey}`
    : `histofacts_draft_guest_${sessionKey}`;
}

function getInterruptedStorageKey(userId) {
  return userId ? `histofacts_interrupted_stream_${userId}` : 'histofacts_interrupted_stream_guest';
}

export function AiNotesProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();

  const userId = user?.id || null;

  // ── Wallet State (Persisted & Authoritative) ───────────────────
  const [wallet, setWalletState] = useState(() => {
    try {
      const cached = localStorage.getItem(getWalletStorageKey(userId));
      if (cached) {
        return { ...DEFAULT_WALLET, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_WALLET;
  });

  const setWallet = useCallback(
    (updater) => {
      setWalletState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem(getWalletStorageKey(userId), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [userId]
  );

  const fetchWallet = useCallback(async () => {
    try {
      const data = await getWalletApi();
      if (data) {
        setWallet(data);
      }
    } catch {
      // Keep cached/default wallet
    }
  }, [setWallet]);

  // ── Layout & UI Navigation State ───────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  // ── Shop Modal & Token Pack State ─────────────────────────────
  const [shopOpen, setShopOpen] = useState(false);
  const [shopPacks, setShopPacks] = useState([]);
  const [confirmPack, setConfirmPack] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const openShop = useCallback(async () => {
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
  }, []);

  const closeShop = useCallback(() => {
    setShopOpen(false);
    setConfirmPack(null);
  }, []);

  const handleBuyPack = useCallback(
    (pack) => {
      if (wallet.histoin_balance < pack.histoin_cost) {
        toast.error(`Insufficient Histoins! Need ${pack.histoin_cost} 🪙`);
        return;
      }
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setConfirmPack({ ...pack, idempotencyKey });
    },
    [wallet.histoin_balance, toast]
  );

  const confirmPurchase = useCallback(async () => {
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
  }, [confirmPack, setWallet, toast]);

  // ── Core Sessions & Conversation Thread State ──────────────────
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteIdState] = useState(() => {
    try {
      const stored = localStorage.getItem(getActiveNoteStorageKey(userId));
      return stored === 'new' ? null : stored;
    } catch {
      return null;
    }
  });
  const [activeThread, setActiveThread] = useState([]);
  const [hasInitializedThread, setHasInitializedThread] = useState(false);

  const activeNoteIdRef = useRef(activeNoteId);
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);

  const setActiveNoteId = useCallback(
    (id) => {
      setActiveNoteIdState(id);
      activeNoteIdRef.current = id;
      try {
        if (id) {
          localStorage.setItem(getActiveNoteStorageKey(userId), id);
        } else {
          localStorage.setItem(getActiveNoteStorageKey(userId), 'new');
        }
      } catch {
        // ignore
      }
    },
    [userId]
  );

  // ── Composer & Draft State (Per-Session Persistence) ───────────
  const [inputValue, setInputValueState] = useState(() => {
    try {
      const initialStored = localStorage.getItem(getActiveNoteStorageKey(userId));
      const initialNoteId = initialStored === 'new' ? null : initialStored;
      return localStorage.getItem(getDraftStorageKey(userId, initialNoteId)) || '';
    } catch {
      return '';
    }
  });

  const setInputValue = useCallback(
    (val) => {
      setInputValueState(val);
      try {
        const currentNoteId = activeNoteIdRef.current;
        const key = getDraftStorageKey(userId, currentNoteId);
        if (val) {
          localStorage.setItem(key, val);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }
    },
    [userId]
  );

  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [thinkEnabled, setThinkEnabled] = useState(false);
  const [isRestylingId, setIsRestylingId] = useState(null);

  // ── Streaming State (Lives in Provider across navigation) ──────
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPrompt, setStreamingPrompt] = useState('');
  const [streamingAttachments, setStreamingAttachments] = useState([]);
  const [streamingText, setStreamingText] = useState('');

  const abortControllerRef = useRef(null);
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Clean up any ongoing stream if the application unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isStreamingRef.current = false;
    };
  }, []);

  // ── Token Estimation ──────────────────────────────────────────
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const est = estimateClientTokens(inputValue, attachedFiles);
      setEstimatedTokens(est);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue, attachedFiles]);

  const isInsufficient = wallet.token_balance < (estimatedTokens || 1200);

  // ── Attachments Handling ──────────────────────────────────────
  const addFiles = useCallback(async (files) => {
    setIsProcessingFiles(true);
    try {
      const processed = await Promise.all(files.map((f) => processAttachedFile(f)));
      setAttachedFiles((prev) => [...prev, ...processed]);
      toast.success(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to process attached files');
    } finally {
      setIsProcessingFiles(false);
    }
  }, [toast]);

  const removeAttachedFile = useCallback((index) => {
    setAttachedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Load Initial Data (Root Notes & Wallet) ────────────────────
  const loadData = useCallback(async () => {
    try {
      const [notesData, walletData] = await Promise.all([
        getMyNotesApi().catch(() => []),
        getWalletApi().catch(() => null),
      ]);
      const validNotes = notesData || [];
      setNotes(validNotes);
      if (walletData) {
        setWallet(walletData);
      }

      // Check if there was an interrupted stream saved in sessionStorage
      let interrupted = null;
      try {
        const rawInterrupted = sessionStorage.getItem(getInterruptedStorageKey(userId));
        if (rawInterrupted) {
          interrupted = JSON.parse(rawInterrupted);
        }
      } catch {
        // ignore
      }

      // Restore active conversation thread
      const savedNoteId = localStorage.getItem(getActiveNoteStorageKey(userId));
      let targetId = null;
      if (savedNoteId === 'new') {
        targetId = null;
      } else if (savedNoteId) {
        targetId = savedNoteId;
      } else if (validNotes.length > 0) {
        targetId = validNotes[0].id;
      }

      if (targetId) {
        setActiveNoteId(targetId);
        try {
          const thread = await getNoteThreadApi(targetId);
          let loadedThread = thread || [];

          // If this session had an interrupted generation from before refresh, append recovered partial turn
          if (interrupted && (interrupted.noteId === targetId || (!targetId && interrupted.isNewSession))) {
            const alreadyInThread = loadedThread.some(
              (t) => t.id === interrupted.tempId || (t.prompt === interrupted.prompt && t.content)
            );
            if (!alreadyInThread && interrupted.partialText) {
              loadedThread = [
                ...loadedThread,
                {
                  id: interrupted.tempId || `interrupted-${Date.now()}`,
                  prompt: interrupted.prompt,
                  content: `${interrupted.partialText}\n\n*[Generation interrupted by browser refresh]*`,
                  style: 'standard',
                  created_at: new Date(interrupted.timestamp || Date.now()).toISOString(),
                },
              ];
            }
            sessionStorage.removeItem(getInterruptedStorageKey(userId));
          }

          setActiveThread(loadedThread);
        } catch {
          const fallback = validNotes.find((n) => n.id === targetId) || validNotes[0] || null;
          if (fallback) {
            setActiveNoteId(fallback.id);
            setActiveThread([fallback]);
          } else {
            setActiveNoteId(null);
            setActiveThread([]);
          }
        }
      } else {
        setActiveNoteId(null);
        if (interrupted && interrupted.partialText) {
          // Interrupted new session with no targetId
          setActiveThread([
            {
              id: interrupted.tempId || `interrupted-${Date.now()}`,
              prompt: interrupted.prompt,
              content: `${interrupted.partialText}\n\n*[Generation interrupted by browser refresh]*`,
              style: 'standard',
              created_at: new Date(interrupted.timestamp || Date.now()).toISOString(),
            },
          ]);
          sessionStorage.removeItem(getInterruptedStorageKey(userId));
        } else {
          setActiveThread([]);
        }
      }

      // Restore draft prompt for active session
      try {
        const savedDraft = localStorage.getItem(getDraftStorageKey(userId, targetId)) || '';
        setInputValueState(savedDraft);
      } catch {
        // ignore
      }
    } catch {
      setNotes([]);
    } finally {
      setHasInitializedThread(true);
    }
  }, [userId, setActiveNoteId, setWallet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── User Isolation (Logout / Switch User Cleanup) ─────────────
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;

      // 1. Abort any running generation from previous user
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isStreamingRef.current = false;
      setIsStreaming(false);
      setStreamingPrompt('');
      setStreamingAttachments([]);
      setStreamingText('');
      setAttachedFiles([]);

      // 2. Clear previous user's in-memory thread and notes immediately
      setNotes([]);
      setActiveThread([]);

      // 3. Re-hydrate or reset wallet for new user
      try {
        const cachedWallet = localStorage.getItem(getWalletStorageKey(userId));
        setWalletState(cachedWallet ? { ...DEFAULT_WALLET, ...JSON.parse(cachedWallet) } : DEFAULT_WALLET);
      } catch {
        setWalletState(DEFAULT_WALLET);
      }

      // 4. Re-hydrate activeNoteId for new user
      let initialNoteId = null;
      try {
        const storedNoteId = localStorage.getItem(getActiveNoteStorageKey(userId));
        initialNoteId = storedNoteId === 'new' ? null : storedNoteId;
      } catch {
        // ignore
      }
      setActiveNoteIdState(initialNoteId);
      activeNoteIdRef.current = initialNoteId;

      // 5. Re-hydrate draft for new user
      try {
        const draft = localStorage.getItem(getDraftStorageKey(userId, initialNoteId)) || '';
        setInputValueState(draft);
      } catch {
        setInputValueState('');
      }

      // 6. Fetch authoritative data for new user
      loadData();
    }
  }, [userId, loadData]);

  // ── Session Switcher ──────────────────────────────────────────
  const handleSelectSavedNote = useCallback(
    async (note) => {
      const noteId = typeof note === 'object' ? note.id : note;
      if (!noteId) return;

      setActiveNoteId(noteId);

      // Load draft for this selected session
      try {
        const savedDraft = localStorage.getItem(getDraftStorageKey(userId, noteId)) || '';
        setInputValueState(savedDraft);
      } catch {
        setInputValueState('');
      }

      try {
        const thread = await getNoteThreadApi(noteId);
        const fallback = typeof note === 'object' ? note : notes.find((n) => n.id === noteId);
        setActiveThread(thread && thread.length > 0 ? thread : (fallback ? [fallback] : []));
      } catch {
        const fallback = typeof note === 'object' ? note : notes.find((n) => n.id === noteId);
        setActiveThread(fallback ? [fallback] : []);
      }
    },
    [userId, notes, setActiveNoteId]
  );

  // ── Start Fresh Session ───────────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveNoteId(null);
    setActiveThread([]);
    setInputValue('');
    setAttachedFiles([]);
    setStreamingText('');
    setStreamingPrompt('');
    setIsStreaming(false);
    try {
      sessionStorage.removeItem(getInterruptedStorageKey(userId));
    } catch {
      // ignore
    }
  }, [userId, setActiveNoteId, setInputValue]);

  // ── Delete Session ────────────────────────────────────────────
  const handleDeleteNote = useCallback(
    async (noteId, e) => {
      if (e) e.stopPropagation();
      if (!window.confirm('Delete this conversation session from your library?')) return;

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
    },
    [activeNoteId, handleNewChat, toast]
  );

  // ── Stop Active Generation ────────────────────────────────────
  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isStreamingRef.current = false;
    setIsStreaming(false);
    try {
      sessionStorage.removeItem(getInterruptedStorageKey(userId));
    } catch {
      // ignore
    }
  }, [userId]);

  // ── Send Message / Stream Generation ──────────────────────────
  const handleSendMessage = useCallback(
    async (customPrompt = null) => {
      const promptText = (customPrompt || inputValue).trim();
      if (
        (!promptText && attachedFiles.length === 0) ||
        isStreaming ||
        isStreamingRef.current ||
        abortControllerRef.current
      ) {
        return;
      }
      isStreamingRef.current = true;

      const estCost = estimateClientTokens(promptText, attachedFiles);
      if (wallet.token_balance < estCost) {
        toast.error(`Not enough tokens! You need ~${estCost.toLocaleString()} tokens.`);
        return;
      }

      const currentFiles = [...attachedFiles];
      const userPrompt =
        promptText ||
        (currentFiles.length > 0
          ? `Analyze attached document: ${currentFiles[0].name}`
          : 'Generate historical study notes');
      const primaryFile = currentFiles[0] || null;

      // Clear composer draft immediately
      setInputValue('');
      setAttachedFiles([]);

      // Setup streaming state
      setIsStreaming(true);
      setStreamingPrompt(userPrompt);
      setStreamingAttachments(currentFiles);
      setStreamingText('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isNewSession =
        !activeNoteId ||
        String(activeNoteId).startsWith('temp-') ||
        String(activeNoteId).startsWith('partial-') ||
        String(activeNoteId).startsWith('interrupted-');

      const tempId = `temp-${Date.now()}`;
      let accumulatedText = '';
      let savedNoteReceived = false;

      // Persist ongoing stream state in sessionStorage in case of full refresh
      const saveInterruptedSnapshot = (text) => {
        try {
          sessionStorage.setItem(
            getInterruptedStorageKey(userId),
            JSON.stringify({
              noteId: activeNoteId,
              isNewSession,
              prompt: userPrompt,
              partialText: text,
              tempId,
              timestamp: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      };

      if (isNewSession) {
        const payload = {
          topic: userPrompt,
          curriculum: 'General History',
          attachment_name: primaryFile?.name || null,
          attachment_type: primaryFile?.type || null,
          attachment_text: primaryFile?.extractedText || null,
          attachment_data: primaryFile?.dataUrl || null,
          think: thinkEnabled,
        };

        try {
          await streamGenerateNoteApi({
            payload,
            onDelta: (delta) => {
              accumulatedText += delta;
              setStreamingText((prev) => prev + delta);
              saveInterruptedSnapshot(accumulatedText);
            },
            onNoteSaved: (savedNote, tokenMeta) => {
              savedNoteReceived = true;
              try {
                sessionStorage.removeItem(getInterruptedStorageKey(userId));
              } catch {
                // ignore
              }
              setNotes((prev) => [savedNote, ...prev.filter((n) => n.id !== savedNote.id)]);
              setActiveNoteId(savedNote.id);
              setActiveThread([savedNote]);
              if (tokenMeta?.token_balance != null) {
                setWallet((prev) => ({ ...prev, token_balance: tokenMeta.token_balance }));
              }
              fetchWallet();
            },
            signal: controller.signal,
          });

          if (!savedNoteReceived && accumulatedText.trim()) {
            const fallbackNote = {
              id: tempId,
              prompt: userPrompt,
              content: accumulatedText,
              style: 'standard',
              attachment_name: primaryFile?.name || null,
              created_at: new Date().toISOString(),
            };
            setNotes((prev) => [fallbackNote, ...prev]);
            setActiveNoteId(fallbackNote.id);
            setActiveThread([fallbackNote]);
          }
        } catch (err) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            if (accumulatedText.trim() && !savedNoteReceived) {
              const partialNote = {
                id: `stopped-${Date.now()}`,
                prompt: userPrompt,
                content: accumulatedText,
                style: 'standard',
                attachment_name: primaryFile?.name || null,
                created_at: new Date().toISOString(),
              };
              setNotes((prev) => [partialNote, ...prev]);
              setActiveNoteId(partialNote.id);
              setActiveThread([partialNote]);
            }
            toast.info?.('Generation stopped') || toast.success('Generation stopped');
          } else if (err.status === 402) {
            toast.error('Insufficient tokens! Visit shop to refill.');
          } else {
            toast.error(err.message || 'Failed to generate note');
          }

          if (
            !savedNoteReceived &&
            accumulatedText.trim() &&
            err.name !== 'AbortError' &&
            !controller.signal.aborted
          ) {
            const fallbackNote = {
              id: `partial-${Date.now()}`,
              prompt: userPrompt,
              content: accumulatedText,
              style: 'standard',
              attachment_name: primaryFile?.name || null,
              created_at: new Date().toISOString(),
            };
            setActiveNoteId(fallbackNote.id);
            setActiveThread([fallbackNote]);
          }
        } finally {
          try {
            sessionStorage.removeItem(getInterruptedStorageKey(userId));
          } catch {
            // ignore
          }
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingPrompt('');
          setStreamingAttachments([]);
          setStreamingText('');
          abortControllerRef.current = null;
        }
      } else {
        // Follow-up Turn in Existing Session Thread
        const payload = {
          message: userPrompt,
          attachment_name: primaryFile?.name || null,
          attachment_type: primaryFile?.type || null,
          attachment_text: primaryFile?.extractedText || null,
          attachment_data: primaryFile?.dataUrl || null,
          think: thinkEnabled,
        };

        try {
          await streamContinueConversationApi({
            noteId: activeNoteId,
            payload,
            onDelta: (delta) => {
              accumulatedText += delta;
              setStreamingText((prev) => prev + delta);
              saveInterruptedSnapshot(accumulatedText);
            },
            onNoteSaved: (newTurn, tokenMeta) => {
              savedNoteReceived = true;
              try {
                sessionStorage.removeItem(getInterruptedStorageKey(userId));
              } catch {
                // ignore
              }
              setActiveThread((prev) => {
                const filtered = prev.filter((t) => t.id !== newTurn.id);
                return [...filtered, newTurn];
              });
              if (tokenMeta?.token_balance != null) {
                setWallet((prev) => ({ ...prev, token_balance: tokenMeta.token_balance }));
              }
              fetchWallet();
            },
            signal: controller.signal,
          });

          if (!savedNoteReceived && accumulatedText.trim()) {
            const fallbackTurn = {
              id: `turn-${Date.now()}`,
              prompt: userPrompt,
              content: accumulatedText,
              style: 'standard',
              attachment_name: primaryFile?.name || null,
              created_at: new Date().toISOString(),
            };
            setActiveThread((prev) => [...prev, fallbackTurn]);
          }
        } catch (err) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            if (accumulatedText.trim() && !savedNoteReceived) {
              const partialTurn = {
                id: `stopped-${Date.now()}`,
                prompt: userPrompt,
                content: accumulatedText,
                style: 'standard',
                attachment_name: primaryFile?.name || null,
                created_at: new Date().toISOString(),
              };
              setActiveThread((prev) => [...prev, partialTurn]);
            }
            toast.info?.('Generation stopped') || toast.success('Generation stopped');
          } else if (err.status === 402) {
            toast.error('Insufficient tokens! Visit shop to refill.');
          } else {
            toast.error(err.message || 'Failed to continue note');
          }

          if (
            !savedNoteReceived &&
            accumulatedText.trim() &&
            err.name !== 'AbortError' &&
            !controller.signal.aborted
          ) {
            const fallbackTurn = {
              id: `partial-${Date.now()}`,
              prompt: userPrompt,
              content: accumulatedText,
              style: 'standard',
              attachment_name: primaryFile?.name || null,
              created_at: new Date().toISOString(),
            };
            setActiveThread((prev) => [...prev, fallbackTurn]);
          }
        } finally {
          try {
            sessionStorage.removeItem(getInterruptedStorageKey(userId));
          } catch {
            // ignore
          }
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingPrompt('');
          setStreamingAttachments([]);
          setStreamingText('');
          abortControllerRef.current = null;
        }
      }
    },
    [
      inputValue,
      attachedFiles,
      isStreaming,
      wallet.token_balance,
      activeNoteId,
      thinkEnabled,
      userId,
      setInputValue,
      setActiveNoteId,
      setWallet,
      fetchWallet,
      toast,
    ]
  );

  // ── Convert to Handwritten Style ──────────────────────────────
  const handleConvertToHandwritten = useCallback(
    async (noteId) => {
      if (!noteId) return;
      if (wallet.token_balance < 1000) {
        toast.error('Not enough tokens to restyle! Please visit the Shop.');
        return;
      }

      setIsRestylingId(noteId);
      try {
        const res = await generateHandwrittenNoteApi(noteId);
        setActiveThread((prev) => [...prev.filter((t) => t.id !== res.id), res]);
        fetchWallet();
        toast.success('Converted to Handwritten Notes!');
      } catch (err) {
        if (err.status === 402) {
          toast.error('Insufficient tokens! Visit shop to refill.');
        } else {
          toast.error(err.message || 'Failed to convert note');
        }
      } finally {
        setIsRestylingId(null);
      }
    },
    [wallet.token_balance, fetchWallet, toast]
  );

  const value = useMemo(
    () => ({
      // State
      notes,
      setNotes,
      activeNoteId,
      setActiveNoteId,
      activeThread,
      setActiveThread,
      hasInitializedThread,
      inputValue,
      setInputValue,
      attachedFiles,
      setAttachedFiles,
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
      fetchWallet,
      estimatedTokens,
      isInsufficient,
      isRestylingId,

      // Layout & Shop UI
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      shopOpen,
      setShopOpen,
      openShop,
      closeShop,
      shopPacks,
      confirmPack,
      setConfirmPack,
      handleBuyPack,
      confirmPurchase,
      isPurchasing,

      // Actions
      loadData,
      handleSendMessage,
      handleStopGenerating,
      handleNewChat,
      handleSelectSavedNote,
      handleDeleteNote,
      handleConvertToHandwritten,
    }),
    [
      notes,
      activeNoteId,
      setActiveNoteId,
      activeThread,
      hasInitializedThread,
      inputValue,
      setInputValue,
      attachedFiles,
      addFiles,
      removeAttachedFile,
      isProcessingFiles,
      thinkEnabled,
      isStreaming,
      streamingPrompt,
      streamingAttachments,
      streamingText,
      wallet,
      setWallet,
      fetchWallet,
      estimatedTokens,
      isInsufficient,
      isRestylingId,
      sidebarOpen,
      toggleSidebar,
      shopOpen,
      openShop,
      closeShop,
      shopPacks,
      confirmPack,
      handleBuyPack,
      confirmPurchase,
      isPurchasing,
      loadData,
      handleSendMessage,
      handleStopGenerating,
      handleNewChat,
      handleSelectSavedNote,
      handleDeleteNote,
      handleConvertToHandwritten,
    ]
  );

  return <AiNotesContext.Provider value={value}>{children}</AiNotesContext.Provider>;
}

export function useAiNotes() {
  const ctx = useContext(AiNotesContext);
  if (!ctx) {
    throw new Error('useAiNotes must be used within an AiNotesProvider');
  }
  return ctx;
}

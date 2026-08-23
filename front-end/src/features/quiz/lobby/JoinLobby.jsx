import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsQR from 'jsqr';
import {
  RightArrowIcon,
  XCircleIcon,
  CrownIcon,
  BookOpenIcon,
} from '../../../components/MotionIcons';

export default function JoinLobby({ onJoinCode, initialCode = '' }) {
  const [joinTab, setJoinTab] = useState('code'); // 'code' | 'link' | 'qr'
  const [code, setCode] = useState(initialCode || '');
  const [linkInput, setLinkInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startCamera = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        requestAnimationFrame(scanQRCode);
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setErrorMsg('Camera access denied or unavailable. Please type the 6-digit code instead.');
      setIsScanning(false);
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode && qrCode.data) {
      let detectedCode = qrCode.data.trim();
      const match = detectedCode.match(/join=([0-9]{6})/i) || detectedCode.match(/\b([0-9]{6})\b/);
      if (match && match[1]) {
        detectedCode = match[1];
      }

      if (detectedCode.length === 6 && /^\d+$/.test(detectedCode)) {
        stopCamera();
        onJoinCode(detectedCode);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanQRCode);
  };

  const handleCodeSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');
    const clean = code.trim();
    if (clean.length !== 6 || !/^\d+$/.test(clean)) {
      setErrorMsg('Please enter a valid 6-digit lobby code (numbers only).');
      return;
    }
    onJoinCode(clean);
  };

  const handleLinkSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');
    const match = linkInput.match(/join=([0-9]{6})/i) || linkInput.match(/\b([0-9]{6})\b/);
    if (match && match[1]) {
      onJoinCode(match[1]);
    } else {
      setErrorMsg('Could not find a valid 6-digit lobby code in this link.');
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-histo-copper/10 border border-histo-copper/20 text-histo-copper text-xs font-ui font-semibold uppercase tracking-wider mb-3">
          <CrownIcon className="h-3.5 w-3.5" /> Player Entry
        </div>
        <h2 className="text-3xl font-display font-bold text-histo-dark mb-2">
          Join a Quiz Lobby
        </h2>
        <p className="text-sm font-body text-histo-ink/70">
          Enter your host's 6-digit code, paste an invite link, or scan their screen QR code.
        </p>
      </div>

      <div className="rounded-histo bg-histo-cream border border-histo-dark/10 p-6 sm:p-8 shadow-medium">
        {/* 3 Entry Point Tabs */}
        <div className="flex rounded-[4px] bg-histo-paper p-1 border border-histo-dark/15 mb-6">
          <button
            type="button"
            onClick={() => { setJoinTab('code'); stopCamera(); setErrorMsg(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider transition-all cursor-pointer ${
              joinTab === 'code'
                ? 'bg-histo-gold text-histo-dark shadow-soft'
                : 'text-histo-ink/60 hover:text-histo-dark hover:bg-white/40'
            }`}
          >
            <span>6-Digit Code</span>
          </button>

          <button
            type="button"
            onClick={() => { setJoinTab('link'); stopCamera(); setErrorMsg(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider transition-all cursor-pointer ${
              joinTab === 'link'
                ? 'bg-histo-gold text-histo-dark shadow-soft'
                : 'text-histo-ink/60 hover:text-histo-dark hover:bg-white/40'
            }`}
          >
            <span>Paste Link</span>
          </button>

          <button
            type="button"
            onClick={() => { setJoinTab('qr'); setErrorMsg(''); startCamera(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[2px] text-xs font-ui font-bold uppercase tracking-wider transition-all cursor-pointer ${
              joinTab === 'qr'
                ? 'bg-histo-gold text-histo-dark shadow-soft'
                : 'text-histo-ink/60 hover:text-histo-dark hover:bg-white/40'
            }`}
          >
            <span>Scan QR</span>
          </button>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 rounded-[4px] bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-ui text-rose-800 flex items-center gap-2"
            >
              <XCircleIcon className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab 1: 6-Digit Code Input */}
        {joinTab === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-ui font-bold uppercase tracking-wider text-histo-dark mb-2">
                Enter Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full text-center text-4xl sm:text-5xl font-display font-bold tracking-[0.25em] rounded-histo border-2 border-histo-dark/20 bg-white py-4 text-histo-dark outline-none placeholder:text-histo-ink/20 focus:border-histo-gold focus:ring-2 focus:ring-histo-gold/20 shadow-soft transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={code.length !== 6}
              className="w-full py-4 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-widest shadow-medium transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Join Lobby</span>
              <RightArrowIcon className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Paste Invite Link */}
        {joinTab === 'link' && (
          <form onSubmit={handleLinkSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-ui font-bold uppercase tracking-wider text-histo-dark mb-2">
                Paste Shareable Link
              </label>
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://histofacts.app/quiz?tab=lobby&join=123456"
                className="w-full rounded-[4px] border border-histo-dark/20 bg-white px-4 py-3.5 text-sm text-histo-dark outline-none placeholder:text-histo-ink/30 focus:border-histo-gold transition-all font-mono shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={!linkInput.trim()}
              className="w-full py-4 rounded-[4px] bg-histo-copper hover:bg-histo-dark text-white text-xs font-ui font-bold uppercase tracking-widest shadow-medium transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Connect via Link</span>
              <RightArrowIcon className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Tab 3: Camera QR Scanner */}
        {joinTab === 'qr' && (
          <div className="text-center space-y-4">
            <div className="relative w-full max-w-sm mx-auto aspect-square rounded-histo overflow-hidden bg-histo-dark border-2 border-histo-dark/20 flex items-center justify-center shadow-medium">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Scanning reticle overlay */}
              <div className="absolute inset-8 border-2 border-histo-gold rounded-lg pointer-events-none animate-pulse">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-histo-gold -mt-1 -ml-1" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-histo-gold -mt-1 -mr-1" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-histo-gold -mb-1 -ml-1" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-histo-gold -mb-1 -mr-1" />
              </div>

              {!isScanning && (
                <div className="absolute inset-0 bg-histo-dark/90 flex flex-col items-center justify-center p-4 text-histo-paper">
                  <BookOpenIcon className="h-8 w-8 text-histo-gold mb-2" />
                  <p className="text-xs font-ui">Initializing camera scanner...</p>
                </div>
              )}
            </div>

            <p className="text-xs font-body text-histo-ink/60 italic">
              Point your device camera at the host's screen to join automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

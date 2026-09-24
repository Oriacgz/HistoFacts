import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { getAvatarSrc } from '../../utils/mediaSrc';

// Post media grid: one image or video renders full-width; 2-4 images render in a balanced grid.
export default function PostMedia({ post }) {
  const [activeImageIndex, setActiveImageIndex] = useState(null);

  const urls = post?.media_urls || [];

  useEffect(() => {
    if (activeImageIndex === null) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveImageIndex(null);
      if (e.key === 'ArrowRight' && urls.length > 1) {
        setActiveImageIndex((prev) => (prev + 1) % urls.length);
      }
      if (e.key === 'ArrowLeft' && urls.length > 1) {
        setActiveImageIndex((prev) => (prev - 1 + urls.length) % urls.length);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, urls.length]);

  if (!post.media_type || post.media_type === 'none') return null;

  if (post.media_type === 'video') {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-histo-dark/10 bg-black">
        <video
          src={getAvatarSrc(post.media_urls?.[0])}
          controls
          className="max-h-[480px] w-full object-contain"
        />
      </div>
    );
  }

  if (urls.length === 0) return null;

  return (
    <>
      <div
        className={`mt-3 grid gap-1 overflow-hidden rounded-2xl border border-histo-dark/10 bg-histo-paper/40 ${
          urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        {urls.map((url, i) => (
          <div
            key={url || i}
            onClick={() => setActiveImageIndex(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveImageIndex(i);
              }
            }}
            aria-label={`View enlarged attachment ${i + 1} of ${urls.length}`}
            className={`group relative cursor-zoom-in overflow-hidden bg-histo-paper/80 ${
              urls.length === 3 && i === 0 ? 'col-span-2' : ''
            }`}
          >
            <img
              src={getAvatarSrc(url)}
              alt={`Chronicle attachment ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              style={{
                maxHeight: urls.length === 1 ? 480 : urls.length === 3 && i === 0 ? 280 : 220,
                minHeight: urls.length === 1 ? 'auto' : 160,
              }}
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="p-2 rounded-full bg-histo-dark/70 text-white shadow-md">
                <ZoomIn className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <AnimatePresence>
        {activeImageIndex !== null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged media preview"
            className="fixed inset-0 z-50 flex items-center justify-center bg-histo-dark/85 backdrop-blur-sm p-4 sm:p-6"
            onClick={() => setActiveImageIndex(null)}
          >
            <button
              type="button"
              onClick={() => setActiveImageIndex(null)}
              aria-label="Close enlarged preview"
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2.5 rounded-full bg-histo-dark/80 text-white/80 hover:text-white hover:bg-histo-copper transition-colors cursor-pointer shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>

            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev - 1 + urls.length) % urls.length);
                  }}
                  aria-label="Previous attachment"
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-histo-dark/80 text-white/80 hover:text-white hover:bg-histo-copper transition-colors cursor-pointer shadow-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev + 1) % urls.length);
                  }}
                  aria-label="Next attachment"
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-histo-dark/80 text-white/80 hover:text-white hover:bg-histo-copper transition-colors cursor-pointer shadow-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-2xl bg-black/40 shadow-2xl flex flex-col items-center"
            >
              <img
                src={getAvatarSrc(urls[activeImageIndex])}
                alt={`Chronicle attachment ${activeImageIndex + 1}`}
                decoding="async"
                className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl"
              />
              {urls.length > 1 && (
                <div className="absolute bottom-3 px-3 py-1 rounded-full bg-histo-dark/80 text-white text-xs font-ui font-medium tracking-wider shadow-md">
                  {activeImageIndex + 1} / {urls.length}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

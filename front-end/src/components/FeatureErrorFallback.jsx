import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * FeatureErrorFallback
 * Themed error card for when a feature route throws an error.
 * Keeps the rest of the app (Navbar, other routes) fully functional.
 *
 * Props:
 *   - featureName (string): Human-readable feature name.
 *   - error (Error | null): The caught error object.
 *   - resetError (Function): Callback to reset the boundary and retry.
 */
export function FeatureErrorFallback({ featureName = 'This feature', error, resetError }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30,20,10,0.97) 0%, rgba(20,12,5,0.99) 100%)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '1rem',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.05)',
          maxWidth: 480,
          width: '100%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
        }}
        role="alert"
        aria-live="assertive"
      >
        {/* Icon */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.25)',
            marginBottom: '1.25rem',
          }}
        >
          <AlertTriangle size={28} color="#d4af37" />
        </div>

        {/* Heading */}
        <h2
          style={{
            fontFamily: "'Cinzel', 'Georgia', serif",
            color: '#d4af37',
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            letterSpacing: '0.03em',
          }}
        >
          {featureName} Encountered an Error
        </h2>

        {/* Subtitle */}
        <p
          style={{
            color: 'rgba(224,210,175,0.7)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred in this section. The rest of HistoFacts is unaffected.
        </p>

        {/* Error detail (dev / collapsed) */}
        {error?.message && (
          <details
            style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                color: 'rgba(224,210,175,0.5)',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                userSelect: 'none',
              }}
            >
              Error detail
            </summary>
            <pre
              style={{
                color: '#f87171',
                fontSize: '0.75rem',
                marginTop: '0.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            id="error-boundary-retry-btn"
            onClick={resetError}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'rgba(212,175,55,0.12)',
              border: '1px solid rgba(212,175,55,0.4)',
              color: '#d4af37',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.18s, border-color 0.18s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.22)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(212,175,55,0.12)';
              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
            }}
          >
            <RefreshCw size={15} />
            Retry Component
          </button>

          <button
            id="error-boundary-home-btn"
            onClick={() => navigate('/home')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(224,210,175,0.7)',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.18s, border-color 0.18s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <Home size={15} />
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

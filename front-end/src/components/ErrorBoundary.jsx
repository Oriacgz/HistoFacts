import { Component } from 'react';
import { FeatureErrorFallback } from './FeatureErrorFallback';

/**
 * ErrorBoundary
 * React class-component error boundary.
 * Catches errors thrown anywhere in the subtree and renders a fallback UI.
 *
 * Props:
 *   - fallback (Function): Render function receiving `{ error, resetError }`.
 *     If omitted, defaults to <FeatureErrorFallback>.
 *   - featureName (string): Human-readable feature name shown in the error card.
 *   - onError (Function): Optional callback called with (error, errorInfo) on capture.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      `[ErrorBoundary] Uncaught error in "${this.props.featureName || 'Unknown'}":`,
      error,
      errorInfo,
    );
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  resetError() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      const { fallback: FallbackFn, featureName } = this.props;

      if (typeof FallbackFn === 'function') {
        return <FallbackFn error={this.state.error} resetError={this.resetError} />;
      }

      // Default: themed HistoFacts error card
      return (
        <FeatureErrorFallback
          featureName={featureName}
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

import { describe, it, expect } from 'vitest';
import { estimateClientTokens, formatFileSize } from './tokenEstimator';

describe('tokenEstimator', () => {
  describe('estimateClientTokens', () => {
    it('returns 0 when text is empty and no attachments', () => {
      expect(estimateClientTokens('', [])).toBe(0);
      expect(estimateClientTokens(null, [])).toBe(0);
    });

    it('estimates tokens for basic text input', () => {
      const text = 'The Industrial Revolution in Britain transformed the economy.';
      const tokens = estimateClientTokens(text, []);
      // Should include prompt tokens + 1200 output allowance
      expect(tokens).toBeGreaterThan(1200);
      expect(tokens).toBeLessThan(1300);
    });

    it('accounts for attachments with extracted text', () => {
      const text = 'Analyze this document';
      const attachments = [
        { name: 'notes.txt', extractedText: 'A'.repeat(400) }, // 400 chars -> ~100 tokens
      ];
      const tokens = estimateClientTokens(text, attachments);
      expect(tokens).toBeGreaterThan(1300);
    });

    it('adds default allowance for attachments without extracted text', () => {
      const text = 'Analyze image';
      const attachments = [
        { name: 'diagram.png', extractedText: '' }, // default +500
      ];
      const tokens = estimateClientTokens(text, attachments);
      expect(tokens).toBeGreaterThanOrEqual(1700);
    });
  });

  describe('formatFileSize', () => {
    it('formats 0 or null bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
    });

    it('formats bytes under 1KB', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });
  });
});

/**
 * Count approximate tokens for a given string (~1.3 tokens per word or 3.8 chars/token).
 */
export function countTokens(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).length;
  return Math.max(Math.round(words * 1.3), Math.round(trimmed.length / 3.8));
}

/**
 * Helper to estimate tokens client-side from input text (~1.3 tokens per word or 3.8 chars/token)
 */
export function estimateClientTokens(text, attachments = []) {
  if (!text && attachments.length === 0) return 0;
  const promptTokens = countTokens(text);
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

/**
 * Format token count with K/M abbreviation:
 * e.g. 346500 -> '346.5K'
 *      350000 -> '350K'
 *      3500   -> '3.5K'
 *      50000  -> '50K'
 *      950    -> '950'
 */
export function formatTokenCount(num) {
  if (num == null || isNaN(num)) return '0';
  const val = Math.max(0, Math.round(num));
  if (val >= 1000000) {
    const m = val / 1000000;
    return `${m % 1 === 0 ? m.toFixed(0) : (Math.round(m * 10) / 10).toFixed(1)}M`;
  }
  if (val >= 1000) {
    const k = val / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : (Math.round(k * 10) / 10).toFixed(1)}K`;
  }
  return val.toLocaleString();
}

/**
 * Format bytes to readable string (B, KB, MB)
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

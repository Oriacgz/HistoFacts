/**
 * Helper to estimate tokens client-side from input text (~1.3 tokens per word or 3.8 chars/token)
 */
export function estimateClientTokens(text, attachments = []) {
  if (!text && attachments.length === 0) return 0;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const promptTokens = Math.max(Math.round(wordCount * 1.3), Math.round(text.length / 3.8));
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
 * Format bytes to readable string (B, KB, MB)
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

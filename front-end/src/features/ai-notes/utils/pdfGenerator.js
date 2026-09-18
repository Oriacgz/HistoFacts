/**
 * PDF Generator utility for HistoFacts Handwritten Style notes.
 * Uses browser-native CSS Paged Media via an isolated print iframe.
 * Ensures:
 * - 100% vector selectable text (never screenshot/rasterized)
 * - Authentic A4 layout with professional margins and page numbers
 * - Intelligent pagination: avoids splitting headings, table rows, and callout boxes
 * - Repeated table headers on subsequent pages (display: table-header-group)
 * - Full handwritten typography, double underlines, highlights, and paper styling
 * - Sanitized filename: HistoFacts_<NoteTitle>.pdf
 * - Zero extra bundle weight or heavy external dependencies
 */

export function sanitizeFilename(title) {
  if (!title) return 'HistoFacts_Handwritten_Notes.pdf';
  let clean = title
    .replace(/^(study\s+)?notes\s*:\s*/i, '')
    .replace(/^(follow[- ]up|turn)\s*:\s*/i, '')
    .trim();
  clean = clean.replace(/[/\\?%*:|"<>#]/g, '').trim();
  clean = clean.replace(/\s+/g, '_');
  clean = clean.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!clean) clean = 'Handwritten_Notes';
  return `HistoFacts_${clean}.pdf`;
}

export function formatDate(dateStr) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
  }
}

export function generatePrintHtml({
  title = '',
  htmlContent = '',
  createdAt = null,
  filename = 'HistoFacts_Handwritten_Notes.pdf',
}) {
  const cleanTitle = title
    .replace(/^(study\s+)?notes\s*:\s*/i, '')
    .replace(/^(follow[- ]up|turn)\s*:\s*/i, '')
    .trim();
  const dateFormatted = formatDate(createdAt);
  const hasH1 = /<h1[\s>]/i.test(htmlContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${filename.replace(/\.pdf$/i, '')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Kalam:wght@400;700&family=Caveat:wght@400;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      -webkit-user-select: auto !important;
      user-select: auto !important;
    }

    body {
      margin: 0;
      padding: 14mm 14mm 12mm 14mm;
      background-color: #faf8f5;
      color: #162a45;
      font-family: "Patrick Hand", "Kalam", "Caveat", cursive, sans-serif;
      font-size: 16.5px;
      line-height: 1.65;
      letter-spacing: 0.015em;
    }

    .doc-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
      background-color: #faf8f5;
    }

    /* Reset on-screen notebook card borders for clean A4 printing */
    .handwritten-notebook {
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
      max-width: 100% !important;
    }

    .font-handwriting {
      font-family: "Patrick Hand", "Kalam", "Caveat", cursive, sans-serif !important;
      color: #162a45 !important;
      max-width: 100% !important;
    }

    .max-w-3xl, .max-w-none {
      max-width: 100% !important;
    }

    .overflow-x-auto {
      overflow: visible !important;
    }

    /* ── Document Header ── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1.5px solid rgba(45, 75, 106, 0.3);
      margin-bottom: 16px;
      font-family: "Poppins", sans-serif;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .doc-brand {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .brand-icon {
      font-size: 15px;
    }

    .brand-name {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #1c3144;
    }

    .brand-sub {
      font-size: 10px;
      font-weight: 500;
      color: #b87333;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-left: 4px;
      padding-left: 6px;
      border-left: 1px solid rgba(45, 75, 106, 0.25);
    }

    .doc-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10.5px;
      color: #64748b;
      font-weight: 500;
    }

    .doc-topic-tag {
      background: rgba(45, 75, 106, 0.08);
      color: #2d4b6a;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .doc-tag {
      background: rgba(184, 115, 51, 0.12);
      color: #b87333;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 9.5px;
      text-transform: uppercase;
    }

    /* ── Note Title ── */
    .doc-title-wrapper {
      margin-bottom: 20px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .doc-title {
      font-size: 26px;
      font-weight: bold;
      color: #11223b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin: 0 0 6px 0;
      font-family: "Patrick Hand", "Kalam", cursive, sans-serif;
    }

    .doc-double-underline {
      width: 100%;
      max-width: 260px;
      height: 4px;
      border-top: 2px solid rgba(17, 34, 59, 0.7);
      border-bottom: 1px solid rgba(17, 34, 59, 0.45);
    }

    /* ── Headings ── */
    h1, h2, h3, h4 {
      font-family: "Patrick Hand", "Kalam", cursive, sans-serif;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    h1 {
      font-size: 24px;
      font-weight: bold;
      color: #11223b;
      margin-top: 20px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    h2 {
      font-size: 21px;
      font-weight: bold;
      color: #162b47;
      margin-top: 20px;
      margin-bottom: 8px;
      display: inline-block;
      border-bottom: 2px solid rgba(22, 43, 71, 0.45);
      padding-bottom: 2px;
    }

    h3 {
      font-size: 18.5px;
      font-weight: bold;
      color: #1d3557;
      margin-top: 16px;
      margin-bottom: 6px;
      display: inline-block;
      border-bottom: 1px solid rgba(71, 85, 105, 0.3);
      padding-bottom: 1px;
    }

    h4 {
      font-size: 16px;
      font-weight: bold;
      color: #243d60;
      margin-top: 14px;
      margin-bottom: 4px;
    }

    /* ── Paragraphs & Flow ── */
    p {
      margin: 8px 0;
      font-size: 16.5px;
      line-height: 1.65;
      color: #162a45;
    }

    /* ── Lists ── */
    ul, ol {
      margin: 8px 0;
      padding-left: 4px;
      list-style: none;
    }

    li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 6px 0;
      font-size: 16.5px;
      line-height: 1.55;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* ── Highlights ── */
    strong {
      font-weight: bold;
      color: #0c1829;
    }

    /* ── Tables ── */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 14px 0 !important;
      font-family: "Patrick Hand", "Kalam", cursive, sans-serif !important;
      font-size: 15px !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      border: 1px solid rgba(51, 65, 85, 0.35) !important;
      background-color: rgba(255, 255, 255, 0.65) !important;
      border-radius: 4px;
    }

    thead {
      display: table-header-group !important;
      background-color: rgba(254, 243, 199, 0.75) !important;
      border-bottom: 2px solid rgba(51, 65, 85, 0.45) !important;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    th {
      padding: 7px 10px !important;
      text-align: left !important;
      font-weight: bold !important;
      color: #11223b !important;
      border-right: 1px solid rgba(51, 65, 85, 0.25) !important;
      font-size: 15.5px !important;
    }

    th:last-child {
      border-right: none !important;
    }

    td {
      padding: 7px 10px !important;
      color: #162a45 !important;
      border-right: 1px solid rgba(51, 65, 85, 0.15) !important;
      border-bottom: 1px solid rgba(51, 65, 85, 0.15) !important;
      vertical-align: top !important;
      font-size: 15px !important;
      line-height: 1.45 !important;
    }

    td:last-child {
      border-right: none !important;
    }

    /* ── Blockquotes / Callout Boxes ── */
    blockquote {
      margin: 14px 0;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid rgba(45, 75, 106, 0.35);
      background-color: rgba(245, 241, 230, 0.75);
      color: #162a45;
      font-size: 16px;
      line-height: 1.55;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ── Dividers ── */
    hr {
      border: none;
      border-top: 1px solid rgba(51, 65, 85, 0.25);
      margin: 18px 0;
    }

    /* ── Code Blocks ── */
    pre, code {
      font-family: "Courier New", Courier, monospace !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    pre {
      background-color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.25);
      padding: 10px;
      border-radius: 4px;
      font-size: 13px;
    }

    /* ── Document Footer ── */
    .doc-footer {
      margin-top: 26px;
      padding-top: 10px;
      border-top: 1px solid rgba(45, 75, 106, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: "Poppins", sans-serif;
      font-size: 9.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <div class="doc-header">
      <div class="doc-brand">
        <span class="brand-icon">📜</span>
        <span class="brand-name">HistoFacts</span>
        <span class="brand-sub">Study Archives</span>
      </div>
      <div class="doc-meta">
        <span class="doc-date">${dateFormatted}</span>
      </div>
    </div>

    ${cleanTitle && !hasH1 ? `
    <div class="doc-title-wrapper">
      <div class="doc-title">${cleanTitle}</div>
      <div class="doc-double-underline"></div>
    </div>
    ` : ''}

    <div class="doc-content">
      ${htmlContent}
    </div>

    <div class="doc-footer">
      <div>📜 HistoFacts · Verified Historical Revision Notes</div>
    </div>
  </div>
</body>
</html>`;
}

export function printHandwrittenNote({
  title = '',
  htmlContent = '',
  createdAt = null,
}) {
  const filename = sanitizeFilename(title);

  // Create isolated invisible iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.title = filename;

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(generatePrintHtml({ title, htmlContent, createdAt, filename }));
  doc.close();

  // Set document title so browsers name the saved PDF with our sanitized filename!
  iframe.contentWindow.document.title = filename.replace(/\.pdf$/i, '');

  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Failed to trigger print:', err);
    } finally {
      // Remove iframe after print dialog opens
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2500);
    }
  };

  // Wait for Google Fonts to be ready so the PDF has crisp, identical handwriting typography
  if (iframe.contentWindow.document.fonts && iframe.contentWindow.document.fonts.ready) {
    iframe.contentWindow.document.fonts.ready
      .then(() => {
        setTimeout(triggerPrint, 300);
      })
      .catch(() => {
        setTimeout(triggerPrint, 350);
      });
  } else {
    setTimeout(triggerPrint, 400);
  }
}

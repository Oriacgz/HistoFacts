export function resolveLobbyCode(value) {
  const raw = String(value || '').trim();
  if (/^\d{6}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const queryCode = url.searchParams.get('join');
    if (/^\d{6}$/.test(queryCode || '')) return queryCode;
    return url.pathname.match(/\/lobby\/(\d{6})\/?$/)?.[1] || null;
  } catch { return null; }
}

export async function readNoteEvents(body, handle) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function frame(value) {
    const data = value.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return false;
    if (data === '[DONE]') return true;
    let parsed;
    try { parsed = JSON.parse(data); } catch { throw new Error('Invalid Notes stream event. Your request can be checked before retrying.'); }
    handle(parsed);
    return false;
  }
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const value = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        if (frame(value)) return;
      }
      if (done) { if (buffer.trim()) frame(buffer); return; }
    }
  } finally {
    try { await reader.cancel(); } catch { /* The network may already be closed. */ }
    reader.releaseLock();
  }
}

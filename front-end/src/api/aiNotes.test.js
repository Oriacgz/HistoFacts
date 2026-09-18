import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamGenerateNoteApi, streamContinueConversationApi } from './aiNotes';

const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};

function createMockStreamResponse(chunks) {
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
  };
}

describe('aiNotes streaming tests (Issue #17)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'test-access-token');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams tokens and processes saved note chunk correctly', async () => {
    const sseChunks = [
      ': keep-alive\n\n',
      'data: {"delta": "Causes "}\n\n',
      'data: {"delta": "of the "}\n\n',
      'data: {"delta": "French Revolution"}\n\n',
      'data: {"note": {"id": "note-123", "title": "French Revolution", "content": "Full content"}}\n\n',
      'data: [DONE]\n\n',
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseChunks));

    const deltas = [];
    let savedNote = null;

    await streamGenerateNoteApi({
      payload: { topic: 'French Revolution' },
      onDelta: (d) => deltas.push(d),
      onNoteSaved: (n) => { savedNote = n; },
    });

    expect(deltas.join('')).toBe('Causes of the French Revolution');
    expect(savedNote).toEqual({ id: 'note-123', title: 'French Revolution', content: 'Full content' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/notes/generate/stream');
    expect(opts.headers.Authorization).toBe('Bearer test-access-token');
  });

  it('handles multi-turn continue streaming and ignores SSE comments', async () => {
    const sseChunks = [
      ': ping\n\n',
      'data: {"delta": "The Tennis Court "}\n\n',
      'data: {"delta": "Oath was taken in June 1789."}\n\n',
      'data: {"note": {"id": "turn-456", "content": "The Tennis Court Oath was taken in June 1789."}}\n\n',
      'data: [DONE]\n\n',
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseChunks));

    const deltas = [];
    let savedNote = null;

    await streamContinueConversationApi({
      noteId: 'note-123',
      payload: { message: 'Tell me about the Tennis Court Oath' },
      onDelta: (d) => deltas.push(d),
      onNoteSaved: (n) => { savedNote = n; },
    });

    expect(deltas.join('')).toBe('The Tennis Court Oath was taken in June 1789.');
    expect(savedNote.id).toBe('turn-456');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/notes/note-123/continue/stream');
  });

  it('throws error when streaming response status is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ detail: 'Insufficient tokens' }),
    });

    await expect(
      streamGenerateNoteApi({
        payload: { topic: 'Ancient Rome' },
        onDelta: vi.fn(),
      })
    ).rejects.toThrow('Insufficient tokens');
  });
});

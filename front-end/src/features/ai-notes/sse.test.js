import { expect, it, vi } from 'vitest';
import { readNoteEvents } from './sse';
function stream(chunks) {
  return new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } });
}
it('handles chunked CRLF frames, multiline data and the final buffered frame', async () => {
  const seen = [];
  await readNoteEvents(stream([': ping\r\n\r\ndata: {"context":', '{"version":2}}\r\n\r\ndata: {\n', 'data: "delta":"History"}\n\ndata: {"note":{"id":"saved"}}']), value => seen.push(value));
  expect(seen).toEqual([{context:{version:2}},{delta:'History'},{note:{id:'saved'}}]);
});
it('propagates callback failures and explicit errors rather than swallowing them', async () => {
  const handler = vi.fn(() => { throw new Error('Stopped'); });
  await expect(readNoteEvents(stream(['data: {"error":"failure"}\n\n']), handler)).rejects.toThrow('Stopped');
  expect(handler).toHaveBeenCalledOnce();
});

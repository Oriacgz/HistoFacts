import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, authenticatedFetch } from './client';

const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
};

describe('apiFetch client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a basic GET request with json content type', async () => {
    const mockData = { id: 1, title: 'Event' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await apiFetch('/api/history/events');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/history/events');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('attaches Authorization header when access_token exists in localStorage', async () => {
    localStorage.setItem('access_token', 'test-token-123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    await apiFetch('/api/wallet/me');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('throws an error with status and detail when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Event not found' }),
    });

    await expect(apiFetch('/api/history/events/999')).rejects.toThrow('Event not found');
  });

  it('refreshes the token before retrying an authenticated raw request', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'new-token', refresh_token: 'new-refresh', user: { id: 'u1' } }),
      })
      .mockResolvedValueOnce({ status: 200, ok: true });

    const response = await authenticatedFetch('/api/notes/generate/stream', { method: 'POST' });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token');
  });
});

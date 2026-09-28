import { describe, it, expect, vi, type Mock, beforeEach, afterEach } from 'vitest';
import { api, ApiError, getApiBase } from './client';
import type { Board, ErrorResponse } from '../types';

// Minimal Typed `fetch` mock: we only inspect what the client sends and we
// fully control what the server "responds".
const mockFetch = vi.fn() as Mock;

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: new Headers({ 'content-length': String(JSON.stringify(body).length) }),
    json: () => Promise.resolve(body),
  };
}

describe('api.client — baseURL', () => {
  it('defaults to /api', () => {
    expect(getApiBase()).toBe('/api');
  });
});

describe('api.client — boards', () => {
  const boards: Board[] = [
    { id: 1, title: 'Backlog', position: 1, createdAt: '2024-01-01 00:00:00' },
    { id: 2, title: 'Done', position: 2, createdAt: '2024-01-02 00:00:00' },
  ];

  it('GET /boards resolves a typed Board[]', async () => {
    mockFetch.mockResolvedValue(json(200, boards));

    const result = await api.boards.list();

    expect(result).toEqual(boards);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [input, init] = mockFetch.mock.calls[0];
    expect(input).toBe('/api/boards');
    expect(init.method).toBe('GET');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('POST /boards sends a JSON body and resolves the created Board', async () => {
    const created: Board = { id: 3, title: 'New', position: 3, createdAt: '2024-01-03 00:00:00' };
    mockFetch.mockResolvedValue(json(201, created));

    const result = await api.boards.create({ title: 'New' });

    expect(result).toEqual(created);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'New' }));
  });

  it('DELETE /boards/:id resolves undefined on 204 No Content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      headers: new Headers({ 'content-length': '0' }),
      json: () => Promise.resolve(undefined),
    });

    await expect(api.boards.remove(3)).resolves.toBeUndefined();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/boards/3');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('GET /boards/:id throws ApiError with status on 404', async () => {
    const errBody: ErrorResponse = { error: 'Board not found' };
    mockFetch.mockResolvedValue(json(404, errBody));

    await expect(api.boards.get(999)).rejects.toMatchObject({
      status: 404,
      message: 'Board not found',
    });

    const thrown = (await api.boards.get(999).catch((e) => e)) as ApiError;
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.status).toBe(404);
    expect(thrown.message).toBe('Board not found');
    expect(thrown.body).toEqual(errBody);
  });

  it('POST with invalid title throws ApiError on 400', async () => {
    mockFetch.mockResolvedValue(json(400, { error: 'title is required' }));

    await expect(api.boards.create({ title: '' })).rejects.toThrow(ApiError);
    await expect(api.boards.create({ title: '' })).rejects.toMatchObject({
      status: 400,
      message: 'title is required',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { create_short_link } from '../src/create-link.js';
import { MemoryLinkStore } from './memory-link-store.js';

describe('create_short_link', () => {
  const now = new Date('2026-05-13T00:00:00.000Z');
  const no_metadata = async () => undefined;

  it('creates a default-TTL generated link', async () => {
    const store = new MemoryLinkStore();
    const result = await create_short_link(store, { url: 'https://example.org' }, 30, now, no_metadata);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.code).toMatch(/^[A-Za-z0-9]{6}$/);
      expect(result.link.is_permanent).toBe(false);
      expect(result.link.expires_at).toBe('2026-06-12T00:00:00.000Z');
      expect(result.link.ttl_epoch_seconds).toBe(Math.floor(Date.parse('2026-06-12T00:00:00.000Z') / 1000));
    }
  });

  it('creates a permanent custom link without DynamoDB TTL', async () => {
    const store = new MemoryLinkStore();
    const result = await create_short_link(
      store,
      { url: 'https://example.org/docs', code: 'docs', permanent: true },
      30,
      now,
      no_metadata,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.code).toBe('docs');
      expect(result.link.is_permanent).toBe(true);
      expect(result.link.expires_at).toBeUndefined();
      expect(result.link.ttl_epoch_seconds).toBeUndefined();
    }
  });

  it('creates a link with an explicit expiry timestamp', async () => {
    const store = new MemoryLinkStore();
    const result = await create_short_link(
      store,
      { url: 'https://example.org/docs', code: 'docs', expires_at: '2026-05-20T12:30:00.000Z' },
      30,
      now,
      no_metadata,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.is_permanent).toBe(false);
      expect(result.link.expires_at).toBe('2026-05-20T12:30:00.000Z');
      expect(result.link.ttl_epoch_seconds).toBe(Math.floor(Date.parse('2026-05-20T12:30:00.000Z') / 1000));
    }
  });

  it('rejects duplicate custom codes with 409', async () => {
    const store = new MemoryLinkStore();

    await create_short_link(store, { url: 'https://example.org/a', code: 'docs' }, 30, now, no_metadata);
    const result = await create_short_link(store, { url: 'https://example.org/b', code: 'docs' }, 30, now, no_metadata);

    expect(result).toEqual({ ok: false, status_code: 409, message: 'Code already exists' });
  });

  it('upserts an existing custom code when force is true', async () => {
    const store = new MemoryLinkStore();

    await create_short_link(store, { url: 'https://example.org/a', code: 'docs' }, 30, now, no_metadata);
    const result = await create_short_link(
      store,
      { url: 'https://example.org/b', code: 'docs', force: true },
      30,
      now,
      async () => ({
        title: 'Updated docs',
        fetched_at: now.toISOString(),
      }),
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.code).toBe('docs');
      expect(result.link.destination_url).toBe('https://example.org/b');
      expect(result.link.metadata).toEqual({
        title: 'Updated docs',
        fetched_at: now.toISOString(),
      });
    }
  });

  it('stores fetched metadata without requiring a create payload option', async () => {
    const store = new MemoryLinkStore();
    const result = await create_short_link(
      store,
      { url: 'https://example.org/docs', code: 'docs' },
      30,
      now,
      async () => ({
        title: 'Example Docs',
        description: 'Useful documentation',
        image: 'https://example.org/og.png',
        fetched_at: now.toISOString(),
      }),
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.metadata).toEqual({
        title: 'Example Docs',
        description: 'Useful documentation',
        image: 'https://example.org/og.png',
        fetched_at: now.toISOString(),
      });
    }
  });

  it('rejects invalid input', async () => {
    const store = new MemoryLinkStore();
    const metadata_fetcher = vi.fn(no_metadata);

    await expect(create_short_link(store, { url: 'ftp://example.org' }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'URL protocol must be http or https',
    });
    await expect(create_short_link(store, { url: 'https://example.org', ttl_days: 0 }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'ttl_days must be a positive integer',
    });
    await expect(create_short_link(store, { url: 'https://example.org', expires_at: '2026-05-12T00:00:00.000Z' }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'expires_at must be in the future',
    });
    await expect(create_short_link(store, { url: 'https://example.org', ttl_days: 5, expires_at: '2026-05-20T00:00:00.000Z' }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'expires_at cannot be used with ttl_days',
    });
    await expect(create_short_link(store, { url: 'https://example.org', permanent: true, expires_at: '2026-05-20T00:00:00.000Z' }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'expires_at cannot be used when permanent is true',
    });
    await expect(create_short_link(store, { url: 'https://example.org', code: 'api' }, 30, now, metadata_fetcher)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'Code is reserved',
    });
    expect(metadata_fetcher).not.toHaveBeenCalled();
  });

  it('creates links without metadata when destination loads successfully but has no metadata', async () => {
    const store = new MemoryLinkStore();
    const metadata_fetcher = vi.fn(no_metadata);

    const result = await create_short_link(
      store,
      { url: 'https://example.org/docs', code: 'docs' },
      30,
      now,
      metadata_fetcher,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.metadata).toBeUndefined();
    }
  });

  it('creates links when metadata fetch fails', async () => {
    const store = new MemoryLinkStore();
    const metadata_fetcher = async () => {
      throw new Error('fetch failed');
    };

    const result = await create_short_link(store, { url: 'https://example.org/docs', code: 'docs' }, 30, now, metadata_fetcher);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.metadata).toBeUndefined();
    }
  });

  it('creates links when metadata fetch returns no metadata', async () => {
    const store = new MemoryLinkStore();
    const metadata_fetcher = async () => undefined;

    const result = await create_short_link(store, { url: 'https://example.org/missing', code: 'missing' }, 30, now, metadata_fetcher);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.metadata).toBeUndefined();
    }
  });
});

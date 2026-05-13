import { describe, expect, it } from 'vitest';
import { create_short_link } from '../src/create-link.js';
import { MemoryLinkStore } from './memory-link-store.js';

describe('create_short_link', () => {
  const now = new Date('2026-05-13T00:00:00.000Z');

  it('creates a default-TTL generated link', async () => {
    const store = new MemoryLinkStore();
    const result = await create_short_link(store, { url: 'https://example.org' }, 30, now);

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
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.link.code).toBe('docs');
      expect(result.link.is_permanent).toBe(true);
      expect(result.link.expires_at).toBeUndefined();
      expect(result.link.ttl_epoch_seconds).toBeUndefined();
    }
  });

  it('rejects duplicate custom codes with 409', async () => {
    const store = new MemoryLinkStore();

    await create_short_link(store, { url: 'https://example.org/a', code: 'docs' }, 30, now);
    const result = await create_short_link(store, { url: 'https://example.org/b', code: 'docs' }, 30, now);

    expect(result).toEqual({ ok: false, status_code: 409, message: 'Code already exists' });
  });

  it('rejects invalid input', async () => {
    const store = new MemoryLinkStore();

    await expect(create_short_link(store, { url: 'ftp://example.org' }, 30, now)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'URL protocol must be http or https',
    });
    await expect(create_short_link(store, { url: 'https://example.org', ttl_days: 0 }, 30, now)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'ttl_days must be a positive integer',
    });
    await expect(create_short_link(store, { url: 'https://example.org', code: 'api' }, 30, now)).resolves.toEqual({
      ok: false,
      status_code: 400,
      message: 'Code is reserved',
    });
  });
});

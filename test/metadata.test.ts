import { afterEach, describe, expect, it, vi } from 'vitest';
import { extract_link_metadata, fetch_link_metadata } from '../src/metadata.js';

describe('extract_link_metadata', () => {
  const now = new Date('2026-05-13T00:00:00.000Z');

  it('prefers Open Graph metadata and resolves relative images', () => {
    const metadata = extract_link_metadata(
      `
        <html>
          <head>
            <meta property="og:title" content="OG &amp; Title">
            <meta property="og:description" content="OG description">
            <meta property="og:image" content="/images/og.png">
            <title>Fallback title</title>
          </head>
        </html>
      `,
      'https://example.org/docs/page',
      now,
    );

    expect(metadata).toEqual({
      title: 'OG & Title',
      description: 'OG description',
      image: 'https://example.org/images/og.png',
      fetched_at: '2026-05-13T00:00:00.000Z',
    });
  });

  it('falls back to title and description tags', () => {
    const metadata = extract_link_metadata(
      `
        <html>
          <head>
            <title>Fallback title</title>
            <meta name="description" content="Fallback description">
          </head>
        </html>
      `,
      'https://example.org/docs/page',
      now,
    );

    expect(metadata).toEqual({
      title: 'Fallback title',
      description: 'Fallback description',
      fetched_at: '2026-05-13T00:00:00.000Z',
    });
  });

  it('returns undefined when no metadata is available', () => {
    expect(extract_link_metadata('<html><body>No preview</body></html>', 'https://example.org', now)).toBeUndefined();
  });
});

describe('fetch_link_metadata', () => {
  const now = new Date('2026-05-13T00:00:00.000Z');
  const public_url = 'https://93.184.216.34/docs';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('succeeds without metadata when the destination returns 200 without metadata', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html><body>No preview</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));

    await expect(fetch_link_metadata(public_url, now)).resolves.toBeUndefined();
  });

  it('succeeds without metadata when the destination returns a redirect', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 302 }));

    await expect(fetch_link_metadata(public_url, now)).resolves.toBeUndefined();
  });

  it('returns no metadata when the destination returns 404 or 500', async () => {
    vi.stubGlobal('fetch', async () => new Response('missing', { status: 404 }));

    await expect(fetch_link_metadata(public_url, now)).resolves.toBeUndefined();

    vi.stubGlobal('fetch', async () => new Response('error', { status: 500 }));

    await expect(fetch_link_metadata(public_url, now)).resolves.toBeUndefined();
  });
});

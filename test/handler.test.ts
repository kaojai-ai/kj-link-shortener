import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsContext } from '../src/analytics.js';
import { handle_request } from '../src/handler.js';
import { MemoryLinkStore } from './memory-link-store.js';

const API_KEY = 'test-api-key';
const FUTURE_EXPIRES_AT = '2099-07-01T10:15:00.000Z';

describe('handler', () => {
  const no_metadata = async () => undefined;
  const metadata = async () => ({
    title: 'Example',
    fetched_at: '2026-05-13T00:00:00.000Z',
  });

  afterEach(() => {
    delete process.env.SHORTENER_PUBLIC_BASE_URL;
  });

  it('creates a default-TTL link through the private API', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'POST', path: '/api/links', api_key: API_KEY, body: { url: 'https://example.org' } }),
      store,
      API_KEY,
      30,
      metadata,
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({
      url: 'https://example.org',
      short_url: expect.stringMatching(/^https:\/\/example.com\//),
      permanent: false,
      metadata: {
        title: 'Example',
        fetched_at: '2026-05-13T00:00:00.000Z',
      },
    });
  });

  it('creates a link with an explicit expires_at timestamp through the private API', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: {
          url: 'https://example.org/docs',
          code: 'docs',
          expires_at: FUTURE_EXPIRES_AT,
        },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({
      code: 'docs',
      expires_at: FUTURE_EXPIRES_AT,
      permanent: false,
    });

    const link = await store.get_link('docs');
    expect(link?.expires_at).toBe(FUTURE_EXPIRES_AT);
    expect(link?.ttl_epoch_seconds).toBe(Math.floor(Date.parse(FUTURE_EXPIRES_AT) / 1000));
  });

  it('rejects create requests without the API key', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'POST', path: '/api/links', body: { url: 'https://example.org' } }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(401);
  });

  it('serves the operator UI at /web', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'GET', path: '/web' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('KJ Link Shortener');
    expect(response.body).toContain('/api/links');
    expect(response.body).toContain('id="custom-path"');
    expect(response.body).toContain('Link lifetime');
    expect(response.body).toContain('Download QR');
    expect(response.body).toContain('Last 20 generated URLs');
    expect(response.body).toContain('id="recent-links-body"');
    expect(response.body).toContain('select_link_for_edit');
    expect(response.body).toContain('id="token-gate"');
    expect(response.body).toContain('id="app-content" hidden');
    expect(response.body).not.toContain('id="expires-at"');
  });

  it('lists the 20 most recently generated links through the private API', async () => {
    const store = new MemoryLinkStore();

    for (let index = 0; index < 21; index += 1) {
      await store.create_link({
        code: `link-${index}`,
        destination_url: `https://example.org/${index}`,
        is_permanent: true,
        now: new Date(`2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
      });
    }

    const response = await handle_request(
      event({ method: 'GET', path: '/api/links', api_key: API_KEY }),
      store,
      API_KEY,
      30,
      no_metadata,
    );
    const body = JSON.parse(response.body ?? '{}');

    expect(response.statusCode).toBe(200);
    expect(body.links).toHaveLength(20);
    expect(body.links[0]).toMatchObject({ code: 'link-20', short_url: 'https://example.com/link-20' });
    expect(body.links.at(-1)).toMatchObject({ code: 'link-1' });
  });

  it('serves the token-gated operator UI at root', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'GET', path: '/' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('placeholder="API token"');
  });

  it('allows all crawlers through robots.txt', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'GET', path: '/robots.txt' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.body).toBe('User-agent: *\nAllow: /\n');
  });

  it('creates links without metadata when destination loads successfully but has no metadata', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'POST', path: '/api/links', api_key: API_KEY, body: { url: 'https://example.org' } }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({
      url: 'https://example.org',
      metadata: null,
    });
  });

  it('redirects active links and records a visit', async () => {
    const store = new MemoryLinkStore();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs', permanent: true },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    const response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30, no_metadata);
    const link = await store.get_link('docs');

    expect(response.statusCode).toBe(302);
    expect(response.headers?.location).toBe('https://example.org/docs');
    expect(link?.visit_count).toBe(1);
  });

  it('emits link_opened analytics for successful human redirects', async () => {
    const store = new MemoryLinkStore();
    const emit_event = async_event_spy();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: {
          url: 'https://example.org/docs?utm_source=line&utm_medium=social&utm_campaign=spring-sale',
          code: 'docs',
          permanent: true,
          owner_context: {
            tenant_id: 'tenant-1',
            source_kind: 'booking_public_link',
            created_by_user_id: 'user-1',
          },
        },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    const response = await handle_request(
      event({
        method: 'GET',
        path: '/docs',
        user_agent: 'Mozilla/5.0',
        query_string: 'preview=false',
        headers: {
          referer: 'https://line.me/',
          'x-forwarded-for': '203.0.113.10, 10.0.0.1',
          'cloudfront-viewer-country': 'TH',
        },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
      {
        emit_event,
        ip_hash_salt: 'salt-123',
      },
    );

    expect(response.statusCode).toBe(302);
    expect(emit_event.calls).toHaveLength(1);
    expect(emit_event.calls[0]).toMatchObject({
      schema_version: 'link_opened.v1',
      short_code: 'docs',
      destination_url: 'https://example.org/docs?utm_source=line&utm_medium=social&utm_campaign=spring-sale',
      tenant_id: 'tenant-1',
      owner_source_kind: 'booking_public_link',
      created_by_user_id: 'user-1',
      referer: 'https://line.me/',
      utm_source: 'line',
      utm_medium: 'social',
      utm_campaign: 'spring-sale',
      user_agent: 'Mozilla/5.0',
      request_host: 'example.com',
      request_path: '/docs',
      raw_query_string: 'preview=false',
      viewer_country: 'TH',
    });
    expect(emit_event.calls[0]?.ip_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not resolve very short link paths', async () => {
    const store = new MemoryLinkStore();
    await store.create_link({
      code: 'abc',
      destination_url: 'https://example.org/docs',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });

    const response = await handle_request(
      event({ method: 'GET', path: '/ab' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(response.statusCode).toBe(404);
  });

  it('does not redirect expired links', async () => {
    const store = new MemoryLinkStore();
    await store.create_link({
      code: 'old',
      destination_url: 'https://example.org/old',
      is_permanent: false,
      expires_at: '2020-01-01T00:00:00.000Z',
      ttl_epoch_seconds: Math.floor(Date.parse('2020-01-01T00:00:00.000Z') / 1000),
      now: new Date('2019-01-01T00:00:00.000Z'),
    });

    const response = await handle_request(event({ method: 'GET', path: '/old' }), store, API_KEY, 30, no_metadata);

    expect(response.statusCode).toBe(404);
  });

  it('does not redirect disabled or missing links', async () => {
    const store = new MemoryLinkStore();
    await store.create_link({
      code: 'disabled',
      destination_url: 'https://example.org/disabled',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });
    await store.disable_link('disabled', new Date('2026-05-13T01:00:00.000Z'));

    const disabled_response = await handle_request(event({ method: 'GET', path: '/disabled' }), store, API_KEY, 30, no_metadata);
    const missing_response = await handle_request(event({ method: 'GET', path: '/missing' }), store, API_KEY, 30, no_metadata);

    expect(disabled_response.statusCode).toBe(404);
    expect(missing_response.statusCode).toBe(404);
  });

  it('does not emit analytics for preview crawlers, missing links, expired links, or disabled links', async () => {
    const store = new MemoryLinkStore();
    const emit_event = async_event_spy();

    await store.create_link({
      code: 'docs',
      destination_url: 'https://example.org/docs',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });
    await store.create_link({
      code: 'old',
      destination_url: 'https://example.org/old',
      is_permanent: false,
      expires_at: '2020-01-01T00:00:00.000Z',
      ttl_epoch_seconds: Math.floor(Date.parse('2020-01-01T00:00:00.000Z') / 1000),
      now: new Date('2019-01-01T00:00:00.000Z'),
    });
    await store.create_link({
      code: 'disabled',
      destination_url: 'https://example.org/disabled',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });
    await store.disable_link('disabled', new Date('2026-05-13T01:00:00.000Z'));

    const analytics_context: AnalyticsContext = {
      emit_event,
    };

    await handle_request(
      event({ method: 'GET', path: '/docs', user_agent: 'Slackbot-LinkExpanding 1.0' }),
      store,
      API_KEY,
      30,
      no_metadata,
      analytics_context,
    );
    await handle_request(event({ method: 'GET', path: '/missing' }), store, API_KEY, 30, no_metadata, analytics_context);
    await handle_request(event({ method: 'GET', path: '/old' }), store, API_KEY, 30, no_metadata, analytics_context);
    await handle_request(event({ method: 'GET', path: '/disabled' }), store, API_KEY, 30, no_metadata, analytics_context);

    expect(emit_event.calls).toHaveLength(0);
  });

  it('continues redirecting when analytics emission fails', async () => {
    const store = new MemoryLinkStore();
    const warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs', permanent: true },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    const response = await handle_request(
      event({ method: 'GET', path: '/docs' }),
      store,
      API_KEY,
      30,
      no_metadata,
      {
        emit_event: async () => {
          throw new Error('firehose unavailable');
        },
      },
    );

    expect(response.statusCode).toBe(302);
    expect(response.headers?.location).toBe('https://example.org/docs');
    expect(warn_spy).toHaveBeenCalledWith('link_opened_event_emit_failed', {
      code: 'docs',
      error: 'firehose unavailable',
    });
  });

  it('returns stored metadata as preview HTML for crawler requests', async () => {
    const store = new MemoryLinkStore();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs', permanent: true },
      }),
      store,
      API_KEY,
      30,
      async () => ({
        title: 'Example <Docs>',
        description: 'Useful "docs"',
        image: 'https://example.org/og.png',
        fetched_at: '2026-05-13T00:00:00.000Z',
      }),
    );

    const response = await handle_request(
      event({ method: 'GET', path: '/docs', user_agent: 'Slackbot-LinkExpanding 1.0' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );
    const link = await store.get_link('docs');

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('<meta property="og:title" content="Example &lt;Docs&gt;">');
    expect(response.body).toContain('<meta property="og:image" content="https://example.org/og.png">');
    expect(response.body).toContain('<meta http-equiv="refresh" content="0;url=https://example.org/docs">');
    expect(response.body).toContain('<p class="status">Redirecting…</p>');
    expect(response.body).toContain('<a class="destination" href="https://example.org/docs">https://example.org/docs</a>');
    expect(link?.visit_count).toBe(0);
  });

  it('uses configured public base URL for short URLs and crawler preview canonical URLs', async () => {
    process.env.SHORTENER_PUBLIC_BASE_URL = 'https://kaoj.ai/';
    const store = new MemoryLinkStore();
    const create_response = await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs' },
      }),
      store,
      API_KEY,
      30,
      metadata,
    );

    expect(JSON.parse(create_response.body ?? '{}').short_url).toBe('https://kaoj.ai/docs');

    const preview_response = await handle_request(
      event({ method: 'GET', path: '/docs', user_agent: 'facebookexternalhit/1.1' }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(preview_response.body).toContain('<link rel="canonical" href="https://kaoj.ai/docs">');
    expect(preview_response.body).toContain('<meta property="og:url" content="https://kaoj.ai/docs">');
  });

  it('updates the destination URL through the private API', async () => {
    const store = new MemoryLinkStore();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs' },
      }),
      store,
      API_KEY,
      30,
      metadata,
    );

    const update_response = await handle_request(
      event({
        method: 'PATCH',
        path: '/api/links/docs',
        api_key: API_KEY,
        body: {
          url: 'https://example.org/new-docs',
          permanent: true,
        },
      }),
      store,
      API_KEY,
      30,
      async () => ({
        title: 'New docs',
        fetched_at: '2026-05-13T01:00:00.000Z',
      }),
    );

    expect(update_response.statusCode).toBe(200);
    expect(JSON.parse(update_response.body ?? '{}')).toMatchObject({
      destination_url: 'https://example.org/new-docs',
      metadata: {
        title: 'New docs',
        fetched_at: '2026-05-13T01:00:00.000Z',
      },
      permanent: true,
    });

    const redirect_response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30, no_metadata);

    expect(redirect_response.statusCode).toBe(302);
    expect(redirect_response.headers?.location).toBe('https://example.org/new-docs');
  });

  it('updates the short code through the private API', async () => {
    const store = new MemoryLinkStore();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/docs', code: 'docs' },
      }),
      store,
      API_KEY,
      30,
      metadata,
    );

    const update_response = await handle_request(
      event({
        method: 'PATCH',
        path: '/api/links/docs',
        api_key: API_KEY,
        body: {
          code: 'manual',
        },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(update_response.statusCode).toBe(200);
    expect(JSON.parse(update_response.body ?? '{}')).toMatchObject({
      code: 'manual',
      short_url: 'https://example.com/manual',
      url: 'https://example.org/docs',
    });

    const old_response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30, no_metadata);
    const new_response = await handle_request(event({ method: 'GET', path: '/manual' }), store, API_KEY, 30, no_metadata);

    expect(old_response.statusCode).toBe(404);
    expect(new_response.statusCode).toBe(302);
    expect(new_response.headers?.location).toBe('https://example.org/docs');
  });

  it('rejects short code updates to an existing code', async () => {
    const store = new MemoryLinkStore();
    await store.create_link({
      code: 'docs',
      destination_url: 'https://example.org/docs',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });
    await store.create_link({
      code: 'taken',
      destination_url: 'https://example.org/taken',
      is_permanent: true,
      now: new Date('2026-05-13T00:00:00.000Z'),
    });

    const update_response = await handle_request(
      event({
        method: 'PATCH',
        path: '/api/links/docs',
        api_key: API_KEY,
        body: {
          code: 'taken',
        },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );

    expect(update_response.statusCode).toBe(409);
    expect(JSON.parse(update_response.body ?? '{}')).toEqual({ error: 'Code already exists' });
  });

  it('upserts an existing code through POST when force is true', async () => {
    const store = new MemoryLinkStore();
    await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/old', code: 'docs' },
      }),
      store,
      API_KEY,
      30,
      no_metadata,
    );
    await store.disable_link('docs', new Date('2026-05-13T01:00:00.000Z'));

    const response = await handle_request(
      event({
        method: 'POST',
        path: '/api/links',
        api_key: API_KEY,
        body: { url: 'https://example.org/new', code: 'docs', force: true, expires_at: FUTURE_EXPIRES_AT },
      }),
      store,
      API_KEY,
      30,
      async () => ({
        title: 'New docs',
        fetched_at: '2026-05-13T02:00:00.000Z',
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({
      code: 'docs',
      url: 'https://example.org/new',
      expires_at: FUTURE_EXPIRES_AT,
      metadata: {
        title: 'New docs',
      },
    });

    const redirect_response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30, no_metadata);

    expect(redirect_response.statusCode).toBe(302);
    expect(redirect_response.headers?.location).toBe('https://example.org/new');

    const link = await store.get_link('docs');
    expect(link?.expires_at).toBe(FUTURE_EXPIRES_AT);
  });
});

function event(input: {
  method: string;
  path: string;
  api_key?: string;
  user_agent?: string;
  body?: unknown;
  query_string?: string;
  headers?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: input.path,
    rawQueryString: input.query_string ?? '',
    headers: {
      host: 'example.com',
      ...(input.user_agent ? { 'user-agent': input.user_agent } : {}),
      ...(input.api_key ? { 'x-api-key': input.api_key } : {}),
      ...(input.headers ?? {}),
    },
    requestContext: {
      accountId: 'offline',
      apiId: 'offline',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: input.method,
        path: input.path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: input.user_agent ?? 'vitest',
      },
      requestId: 'test',
      routeKey: '$default',
      stage: '$default',
      time: '13/May/2026:00:00:00 +0000',
      timeEpoch: 1778630400000,
    },
    isBase64Encoded: false,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  };
}

function async_event_spy() {
  const calls: Array<Record<string, unknown>> = [];

  return Object.assign(async (event: Record<string, unknown>) => {
    calls.push(event);
  }, { calls });
}

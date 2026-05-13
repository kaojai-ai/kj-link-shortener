import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { afterEach, describe, expect, it } from 'vitest';
import { handle_request } from '../src/handler.js';
import { MemoryLinkStore } from './memory-link-store.js';

const API_KEY = 'test-api-key';

describe('handler', () => {
  const no_metadata = async () => undefined;
  const metadata = async () => ({
    title: 'Example',
    fetched_at: '2026-05-13T00:00:00.000Z',
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
    });

    const redirect_response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30, no_metadata);

    expect(redirect_response.statusCode).toBe(302);
    expect(redirect_response.headers?.location).toBe('https://example.org/new-docs');
  });
});

function event(input: {
  method: string;
  path: string;
  api_key?: string;
  user_agent?: string;
  body?: unknown;
}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: input.path,
    rawQueryString: '',
    headers: {
      host: 'example.com',
      ...(input.user_agent ? { 'user-agent': input.user_agent } : {}),
      ...(input.api_key ? { 'x-api-key': input.api_key } : {}),
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
  afterEach(() => {
    delete process.env.SHORTENER_PUBLIC_BASE_URL;
  });

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { handle_request } from '../src/handler.js';
import { MemoryLinkStore } from './memory-link-store.js';

const API_KEY = 'test-api-key';

describe('handler', () => {
  it('creates a default-TTL link through the private API', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'POST', path: '/api/links', api_key: API_KEY, body: { url: 'https://example.org' } }),
      store,
      API_KEY,
      30,
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}')).toMatchObject({
      url: 'https://example.org',
      permanent: false,
    });
  });

  it('rejects create requests without the API key', async () => {
    const store = new MemoryLinkStore();
    const response = await handle_request(
      event({ method: 'POST', path: '/api/links', body: { url: 'https://example.org' } }),
      store,
      API_KEY,
      30,
    );

    expect(response.statusCode).toBe(401);
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
    );

    const response = await handle_request(event({ method: 'GET', path: '/docs' }), store, API_KEY, 30);
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

    const response = await handle_request(event({ method: 'GET', path: '/old' }), store, API_KEY, 30);

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

    const disabled_response = await handle_request(event({ method: 'GET', path: '/disabled' }), store, API_KEY, 30);
    const missing_response = await handle_request(event({ method: 'GET', path: '/missing' }), store, API_KEY, 30);

    expect(disabled_response.statusCode).toBe(404);
    expect(missing_response.statusCode).toBe(404);
  });
});

function event(input: {
  method: string;
  path: string;
  api_key?: string;
  body?: unknown;
}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: input.path,
    rawQueryString: '',
    headers: {
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
        userAgent: 'vitest',
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

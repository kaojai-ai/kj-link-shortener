import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { handle_request } from '../src/handler.js';
import { normalize_live_url } from '../src/public-live-link.js';
import { MemoryLinkStore } from './memory-link-store.js';

const no_metadata = async () => undefined;

describe('normalize_live_url', () => {
  it('accepts LIVE Cam view links and sorts params', () => {
    expect(normalize_live_url('https://kaojai.ai/th/live?z=12&c=13.7563,100.5018&cam=abc-1'))
      .toBe('https://kaojai.ai/th/live/?c=13.7563%2C100.5018&cam=abc-1&z=12');
  });

  it.each([
    'https://evil.example/th/live/',
    'https://kaojai.ai/th/pricing/',
    'http://kaojai.ai/th/live/',
    'https://kaojai.ai/th/live/?next=https://evil.example',
    'https://kaojai.ai/th/live/?z=12&z=13',
    'https://kaojai.ai/th/live/#x',
    'https://user@kaojai.ai/th/live/',
  ])('rejects %s', (url) => {
    expect(normalize_live_url(url)).toBeNull();
  });
});

describe('public live link endpoint', () => {
  it('creates a short link without an API key and dedupes the same view', async () => {
    const store = new MemoryLinkStore();
    const url = 'https://kaojai.ai/en/live/?c=13.7563,100.5018&z=12';
    const first = await handle_request(event('POST', { url }), store, 'secret', 30, no_metadata);
    const second = await handle_request(event('POST', { url: 'https://kaojai.ai/en/live/?z=12&c=13.7563,100.5018' }), store, 'secret', 30, no_metadata);

    expect(first.statusCode).toBe(201);
    expect(first.headers?.['access-control-allow-origin']).toBe('https://kaojai.ai');
    const first_body = JSON.parse(first.body ?? '{}');
    expect(first_body.short_url).toMatch(/^https:\/\/example.com\/live_[A-Za-z0-9]{7}$/);
    expect(JSON.parse(second.body ?? '{}').code).toBe(first_body.code);
    const stored = await store.get_link(first_body.code);
    expect(stored?.owner_context?.source_kind).toBe('livecam_public');
    const ttl_days = (Date.parse(stored?.expires_at ?? '') - Date.parse(stored?.created_at ?? '')) / 86_400_000;
    expect(ttl_days).toBeCloseTo(30, 3);
  });

  it('rejects non LIVE Cam destinations', async () => {
    const response = await handle_request(event('POST', { url: 'https://evil.example/' }), new MemoryLinkStore(), 'secret', 30, no_metadata);
    expect(response.statusCode).toBe(400);
  });

  it('answers CORS preflight only for allowed origins', async () => {
    const allowed = await handle_request(event('OPTIONS'), new MemoryLinkStore(), 'secret', 30, no_metadata);
    const denied = await handle_request(event('OPTIONS', undefined, 'https://evil.example'), new MemoryLinkStore(), 'secret', 30, no_metadata);
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers?.['access-control-allow-origin']).toBe('https://kaojai.ai');
    expect(denied.headers?.['access-control-allow-origin']).toBeUndefined();
  });
});

function event(method: string, body?: unknown, origin = 'https://kaojai.ai'): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/api/public/live-links',
    rawQueryString: '',
    headers: { host: 'example.com', origin },
    requestContext: {
      accountId: 'offline',
      apiId: 'offline',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: { method, path: '/api/public/live-links', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
      requestId: 'test',
      routeKey: '$default',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

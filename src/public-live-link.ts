import { createHash } from 'node:crypto';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { create_short_link } from './create-link.js';
import { is_link_active, type LinkStore, type ShortLink } from './link-store.js';
import type { MetadataFetcher } from './metadata.js';

export const PUBLIC_LIVE_LINK_PATH = '/api/public/live-links';

const LIVE_LINK_TTL_DAYS = 30;
const MAX_BODY_LENGTH = 1_024;
const MAX_URL_LENGTH = 512;
const DEFAULT_ALLOWED_HOSTS = ['kaojai.ai', 'www.kaojai.ai'];
const LIVE_PATH_PATTERN = /^\/(?:th|en)\/live\/?$/;
const ID_PATTERN = /^[A-Za-z0-9_:.-]{1,80}$/;

const PARAM_PATTERNS: Record<string, RegExp> = {
  c: /^-?\d{1,2}(?:\.\d{1,6})?,-?\d{1,3}(?:\.\d{1,6})?$/,
  z: /^\d{1,2}$/,
  cam: ID_PATTERN,
  inc: ID_PATTERN,
  q: /^[^<>]{1,80}$/u,
  inc_off: /^1$/,
  fav: /^1$/,
};

export type PublicLiveLinkResult =
  | { ok: true; link: ShortLink }
  | { ok: false; status_code: 400 | 500; message: string };

export function allowed_live_hosts(): string[] {
  const extra = (process.env.LIVE_LINK_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...extra];
}

export function normalize_live_url(raw: unknown, hosts = allowed_live_hosts()): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const is_local = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if ((url.protocol !== 'https:' && !is_local) || url.username || url.password || url.hash) return null;
  if (!hosts.includes(url.host.toLowerCase()) || !LIVE_PATH_PATTERN.test(url.pathname)) return null;

  const params = [...url.searchParams.entries()];
  const seen = new Set<string>();
  for (const [key, value] of params) {
    const pattern = PARAM_PATTERNS[key];
    if (!pattern || seen.has(key) || !pattern.test(value)) return null;
    seen.add(key);
  }

  const sorted = new URLSearchParams(params.sort(([a], [b]) => a.localeCompare(b)));
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const query = sorted.toString();
  return `${url.protocol}//${url.host.toLowerCase()}${path}${query ? `?${query}` : ''}`;
}

export function live_link_code(normalized_url: string): string {
  const digest = createHash('sha256').update(normalized_url).digest('base64url').replace(/[-_]/g, '');
  return `live_${digest.slice(0, 7)}`;
}

export async function create_public_live_link(
  store: LinkStore,
  body: string | undefined,
  now: Date,
  metadata_fetcher: MetadataFetcher,
): Promise<PublicLiveLinkResult> {
  if (!body || body.length > MAX_BODY_LENGTH) {
    return { ok: false, status_code: 400, message: 'Invalid request body' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, status_code: 400, message: 'Request body must be valid JSON' };
  }

  const url = normalize_live_url((parsed as { url?: unknown } | null)?.url);
  if (!url) {
    return { ok: false, status_code: 400, message: 'url must be a KaoJai LIVE Cam link' };
  }

  const code = live_link_code(url);
  const existing = await store.get_link(code);
  if (existing && existing.destination_url === url && is_link_active(existing, now)) {
    return { ok: true, link: existing };
  }

  const result = await create_short_link(
    store,
    {
      url,
      code,
      ttl_days: LIVE_LINK_TTL_DAYS,
      force: true,
      owner_context: { source_kind: 'livecam_public' },
    },
    LIVE_LINK_TTL_DAYS,
    now,
    metadata_fetcher,
  );

  if (!result.ok) {
    return { ok: false, status_code: result.status_code === 500 ? 500 : 400, message: result.message };
  }

  return result;
}

export function with_cors(
  response: APIGatewayProxyStructuredResultV2,
  origin: string | undefined,
): APIGatewayProxyStructuredResultV2 {
  if (!origin || !is_allowed_origin(origin)) return response;

  return {
    ...response,
    headers: {
      ...response.headers,
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  };
}

function is_allowed_origin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const is_local = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    return (url.protocol === 'https:' || is_local) && allowed_live_hosts().includes(url.host.toLowerCase());
  } catch {
    return false;
  }
}

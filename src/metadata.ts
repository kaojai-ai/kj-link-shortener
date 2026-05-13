import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { TextDecoder } from 'node:util';
import type { LinkMetadata } from './link-store.js';

const MAX_METADATA_BYTES = 512 * 1024;
const MAX_METADATA_REDIRECTS = 3;
const METADATA_FETCH_TIMEOUT_MS = 2_000;

type PublicUrlCheck = { ok: true } | { ok: false; reason: string };

export type MetadataFetcher = (destination_url: string, now: Date) => Promise<LinkMetadata | undefined>;

export async function fetch_link_metadata(destination_url: string, now = new Date()): Promise<LinkMetadata | undefined> {
  let current_url = new URL(destination_url);

  for (let redirect_count = 0; redirect_count <= MAX_METADATA_REDIRECTS; redirect_count += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

    try {
      const url_check = await validate_public_http_url(current_url);

      if (!url_check.ok) {
        console.warn('metadata_fetch_blocked', { reason: url_check.reason, url: current_url.toString() });
        return undefined;
      }

      const response = await fetch(current_url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'kj-link-shortener/0.1 metadata fetcher',
        },
      });

      if (is_redirect_response(response.status)) {
        const location = response.headers.get('location');

        if (!location) {
          return undefined;
        }

        if (redirect_count === MAX_METADATA_REDIRECTS) {
          return undefined;
        }

        try {
          current_url = new URL(location, current_url);
        } catch {
          return undefined;
        }

        continue;
      }

      if (response.status < 200 || !response.ok) {
        return undefined;
      }

      if (!is_html_response(response)) {
        return undefined;
      }

      const html = await read_limited_text(response);
      return extract_link_metadata(html, response.url || current_url.toString(), now);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn('metadata_fetch_failed', {
        error: message,
        url: current_url.toString(),
      });
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  return undefined;
}

export function extract_link_metadata(html: string, page_url: string, now = new Date()): LinkMetadata | undefined {
  const title = first_non_empty([
    extract_meta_content(html, 'property', 'og:title'),
    extract_meta_content(html, 'name', 'twitter:title'),
    extract_title(html),
  ]);
  const description = first_non_empty([
    extract_meta_content(html, 'property', 'og:description'),
    extract_meta_content(html, 'name', 'twitter:description'),
    extract_meta_content(html, 'name', 'description'),
  ]);
  const image_value = first_non_empty([
    extract_meta_content(html, 'property', 'og:image'),
    extract_meta_content(html, 'property', 'og:image:secure_url'),
    extract_meta_content(html, 'name', 'twitter:image'),
  ]);
  const image = image_value ? resolve_metadata_url(image_value, page_url) : undefined;

  if (!title && !description && !image) {
    return undefined;
  }

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    fetched_at: now.toISOString(),
  };
}

async function validate_public_http_url(url: URL): Promise<PublicUrlCheck> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'local_hostname' };
  }

  if (is_blocked_ip(hostname)) {
    return { ok: false, reason: 'blocked_ip' };
  }

  if (isIP(hostname) !== 0) {
    return { ok: true };
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    return { ok: false, reason: 'dns_empty' };
  }

  if (addresses.some((address) => is_blocked_ip(address.address))) {
    return { ok: false, reason: 'blocked_dns_ip' };
  }

  return { ok: true };
}

function is_blocked_ip(address: string): boolean {
  const ip_family = isIP(address);

  if (ip_family === 4) {
    const parts = address.split('.').map(Number);
    const [a = 0, b = 0] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 ||
      a === 198 && (b === 18 || b === 19) ||
      a >= 224
    );
  }

  if (ip_family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('2001:db8:')
    );
  }

  return false;
}

function is_redirect_response(status: number): boolean {
  return status >= 300 && status < 400;
}

function is_html_response(response: Response): boolean {
  const content_type = response.headers.get('content-type');
  return !content_type || content_type.includes('text/html') || content_type.includes('application/xhtml+xml');
}

async function read_limited_text(response: Response): Promise<string> {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes_read = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    const remaining_bytes = MAX_METADATA_BYTES - bytes_read;
    const chunk = result.value;

    if (chunk.byteLength > remaining_bytes) {
      chunks.push(chunk.subarray(0, Math.max(remaining_bytes, 0)));
      await reader.cancel();
      break;
    }

    chunks.push(chunk);
    bytes_read += chunk.byteLength;
  }

  return new TextDecoder().decode(concat_chunks(chunks));
}

function concat_chunks(chunks: Uint8Array[]): Uint8Array {
  const total_length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total_length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function extract_meta_content(html: string, attribute_name: 'name' | 'property', attribute_value: string): string | undefined {
  const tag_match = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attribute_name}\\s*=\\s*["']${escape_regex(attribute_value)}["'])(?=[^>]*\\bcontent\\s*=)[^>]*>`, 'i'));

  if (!tag_match?.[0]) {
    return undefined;
  }

  const content_match = tag_match[0].match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
  return content_match?.[2] ? clean_text(content_match[2]) : undefined;
}

function extract_title(html: string): string | undefined {
  const title_match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return title_match?.[1] ? clean_text(title_match[1]) : undefined;
}

function first_non_empty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== '');
}

function clean_text(value: string): string | undefined {
  const cleaned = decode_html_entities(value.replace(/\s+/g, ' ').trim());
  return cleaned === '' ? undefined : cleaned;
}

function decode_html_entities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function resolve_metadata_url(value: string, page_url: string): string | undefined {
  try {
    return new URL(value, page_url).toString();
  } catch {
    return undefined;
  }
}

function escape_regex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

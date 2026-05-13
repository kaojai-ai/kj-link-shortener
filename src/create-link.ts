import { DuplicateCodeError, type LinkStore, type ShortLink } from './link-store.js';
import { fetch_link_metadata, type MetadataFetcher } from './metadata.js';
import {
  generate_code,
  normalize_custom_code,
  validate_custom_code,
} from './short-code.js';
import { normalize_destination_url, validate_destination_url } from './url.js';

const MAX_GENERATED_CODE_ATTEMPTS = 8;

export type CreateLinkRequest = {
  url?: unknown;
  code?: unknown;
  ttl_days?: unknown;
  permanent?: unknown;
};

export type CreateLinkResult =
  | { ok: true; link: ShortLink }
  | { ok: false; status_code: 400 | 409 | 500; message: string };

export async function create_short_link(
  store: LinkStore,
  request: CreateLinkRequest,
  default_ttl_days: number,
  now = new Date(),
  metadata_fetcher: MetadataFetcher = fetch_link_metadata,
): Promise<CreateLinkResult> {
  if (typeof request.url !== 'string') {
    return { ok: false, status_code: 400, message: 'url is required' };
  }

  const destination_url = normalize_destination_url(request.url);
  const url_error = validate_destination_url(destination_url);

  if (url_error) {
    return { ok: false, status_code: 400, message: url_error };
  }

  const permanent = request.permanent === true;
  const ttl_days_result = parse_ttl_days(request.ttl_days, default_ttl_days);

  if (!ttl_days_result.ok) {
    return ttl_days_result;
  }

  const custom_code = typeof request.code === 'string' && request.code.trim() !== ''
    ? normalize_custom_code(request.code)
    : undefined;

  if (custom_code) {
    const code_error = validate_custom_code(custom_code);

    if (code_error) {
      return { ok: false, status_code: 400, message: code_error };
    }
  }

  const metadata = await fetch_metadata_safely(metadata_fetcher, destination_url, now);

  if (custom_code) {
    return create_custom_link(store, {
      code: custom_code,
      destination_url,
      metadata,
      permanent,
      ttl_days: ttl_days_result.ttl_days,
      now,
    });
  }

  return create_generated_link(store, {
    destination_url,
    metadata,
    permanent,
    ttl_days: ttl_days_result.ttl_days,
    now,
  });
}

type CreateLinkFields = {
  code?: string;
  destination_url: string;
  metadata?: ShortLink['metadata'];
  permanent: boolean;
  ttl_days: number;
  now: Date;
};

async function create_custom_link(store: LinkStore, fields: CreateLinkFields & { code: string }): Promise<CreateLinkResult> {
  const code_error = validate_custom_code(fields.code);

  if (code_error) {
    return { ok: false, status_code: 400, message: code_error };
  }

  try {
    return {
      ok: true,
      link: await store.create_link(build_create_input(fields)),
    };
  } catch (error) {
    if (error instanceof DuplicateCodeError) {
      return { ok: false, status_code: 409, message: 'Code already exists' };
    }

    throw error;
  }
}

async function create_generated_link(store: LinkStore, fields: CreateLinkFields): Promise<CreateLinkResult> {
  for (let attempt = 0; attempt < MAX_GENERATED_CODE_ATTEMPTS; attempt += 1) {
    try {
      return {
        ok: true,
        link: await store.create_link(build_create_input({
          ...fields,
          code: generate_code(),
        })),
      };
    } catch (error) {
      if (error instanceof DuplicateCodeError) {
        continue;
      }

      throw error;
    }
  }

  return { ok: false, status_code: 500, message: 'Unable to allocate a short code' };
}

function build_create_input(fields: CreateLinkFields & { code: string }) {
  if (fields.permanent) {
    return {
      code: fields.code,
      destination_url: fields.destination_url,
      ...(fields.metadata ? { metadata: fields.metadata } : {}),
      is_permanent: true,
      now: fields.now,
    };
  }

  const expires_at = new Date(fields.now.getTime() + fields.ttl_days * 24 * 60 * 60 * 1000);

  return {
    code: fields.code,
    destination_url: fields.destination_url,
    ...(fields.metadata ? { metadata: fields.metadata } : {}),
    is_permanent: false,
    expires_at: expires_at.toISOString(),
    ttl_epoch_seconds: Math.floor(expires_at.getTime() / 1000),
    now: fields.now,
  };
}

export async function fetch_metadata_safely(
  metadata_fetcher: MetadataFetcher,
  destination_url: string,
  now: Date,
): Promise<ShortLink['metadata'] | undefined> {
  try {
    return await metadata_fetcher(destination_url, now);
  } catch (error) {
    console.warn('metadata_fetch_failed', {
      error: error instanceof Error ? error.message : 'unknown error',
      url: destination_url,
    });
    return undefined;
  }
}

function parse_ttl_days(value: unknown, default_ttl_days: number): { ok: true; ttl_days: number } | { ok: false; status_code: 400; message: string } {
  if (value === undefined || value === null) {
    return { ok: true, ttl_days: default_ttl_days };
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return { ok: false, status_code: 400, message: 'ttl_days must be a positive integer' };
  }

  return { ok: true, ttl_days: value };
}

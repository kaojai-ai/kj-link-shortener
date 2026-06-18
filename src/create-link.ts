import {
  DuplicateCodeError,
  type LinkExpiryUpdate,
  type LinkStore,
  type OwnerContext,
  type ShortLink,
} from './link-store.js';
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
  expires_at?: unknown;
  permanent?: unknown;
  force?: unknown;
  owner_context?: unknown;
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
  const force = request.force === true;
  const expiry_result = parse_expiry(request, default_ttl_days, now);

  if (!expiry_result.ok) {
    return expiry_result;
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

  const owner_context_result = parse_owner_context(request.owner_context);

  if (!owner_context_result.ok) {
    return owner_context_result;
  }

  const metadata = await fetch_metadata_safely(metadata_fetcher, destination_url, now);

  if (custom_code) {
    return create_custom_link(store, {
      code: custom_code,
      destination_url,
      metadata,
      owner_context: owner_context_result.owner_context,
      force,
      expiry: expiry_result.expiry,
      now,
    });
  }

  return create_generated_link(store, {
    destination_url,
    metadata,
    owner_context: owner_context_result.owner_context,
    force: false,
    expiry: expiry_result.expiry,
    now,
  });
}

type LinkExpiry =
  | { is_permanent: true }
  | { is_permanent: false; expires_at: Date };

type CreateLinkFields = {
  code?: string;
  destination_url: string;
  metadata?: ShortLink['metadata'];
  owner_context?: OwnerContext;
  force: boolean;
  expiry: LinkExpiry;
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
      if (fields.force) {
        const link = await store.update_url(
          fields.code,
          fields.destination_url,
          fields.metadata,
          fields.now,
          build_expiry_update(fields.expiry),
        );

        if (link) {
          return { ok: true, link };
        }
      }

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
  if (fields.expiry.is_permanent) {
    return {
      code: fields.code,
      destination_url: fields.destination_url,
      ...(fields.metadata ? { metadata: fields.metadata } : {}),
      ...(fields.owner_context ? { owner_context: fields.owner_context } : {}),
      is_permanent: true,
      now: fields.now,
    };
  }

  const expires_at = fields.expiry.expires_at;

  return {
    code: fields.code,
    destination_url: fields.destination_url,
    ...(fields.metadata ? { metadata: fields.metadata } : {}),
    ...(fields.owner_context ? { owner_context: fields.owner_context } : {}),
    is_permanent: false,
    expires_at: expires_at.toISOString(),
    ttl_epoch_seconds: Math.floor(expires_at.getTime() / 1000),
    now: fields.now,
  };
}

function parse_owner_context(
  owner_context: unknown,
): { ok: true; owner_context?: OwnerContext } | { ok: false; status_code: 400; message: string } {
  if (owner_context === undefined || owner_context === null) {
    return { ok: true };
  }

  if (!is_record(owner_context)) {
    return { ok: false, status_code: 400, message: 'owner_context must be an object' };
  }

  if (
    owner_context.source_kind !== 'booking_public_link' &&
    owner_context.source_kind !== 'manual' &&
    owner_context.source_kind !== 'unknown'
  ) {
    return { ok: false, status_code: 400, message: 'owner_context.source_kind is invalid' };
  }

  if (owner_context.tenant_id !== undefined && typeof owner_context.tenant_id !== 'string') {
    return { ok: false, status_code: 400, message: 'owner_context.tenant_id must be a string' };
  }

  if (owner_context.source_id !== undefined && typeof owner_context.source_id !== 'string') {
    return { ok: false, status_code: 400, message: 'owner_context.source_id must be a string' };
  }

  if (owner_context.created_by_user_id !== undefined && typeof owner_context.created_by_user_id !== 'string') {
    return { ok: false, status_code: 400, message: 'owner_context.created_by_user_id must be a string' };
  }

  return {
    ok: true,
    owner_context: {
      ...(owner_context.tenant_id ? { tenant_id: owner_context.tenant_id } : {}),
      source_kind: owner_context.source_kind,
      ...(owner_context.source_id ? { source_id: owner_context.source_id } : {}),
      ...(owner_context.created_by_user_id ? { created_by_user_id: owner_context.created_by_user_id } : {}),
    },
  };
}

function build_expiry_update(expiry: LinkExpiry): LinkExpiryUpdate {
  if (expiry.is_permanent) {
    return {
      is_permanent: true,
    };
  }

  return {
    is_permanent: false,
    expires_at: expiry.expires_at.toISOString(),
    ttl_epoch_seconds: Math.floor(expiry.expires_at.getTime() / 1000),
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

function parse_expiry(
  request: CreateLinkRequest,
  default_ttl_days: number,
  now: Date,
): { ok: true; expiry: LinkExpiry } | { ok: false; status_code: 400; message: string } {
  if (request.permanent === true) {
    if (request.expires_at !== undefined && request.expires_at !== null) {
      return { ok: false, status_code: 400, message: 'expires_at cannot be used when permanent is true' };
    }

    return { ok: true, expiry: { is_permanent: true } };
  }

  if (request.expires_at !== undefined && request.expires_at !== null) {
    if (request.ttl_days !== undefined && request.ttl_days !== null) {
      return { ok: false, status_code: 400, message: 'expires_at cannot be used with ttl_days' };
    }

    return parse_expires_at(request.expires_at, now);
  }

  const ttl_days_result = parse_ttl_days(request.ttl_days, default_ttl_days);

  if (!ttl_days_result.ok) {
    return ttl_days_result;
  }

  return {
    ok: true,
    expiry: {
      is_permanent: false,
      expires_at: new Date(now.getTime() + ttl_days_result.ttl_days * 24 * 60 * 60 * 1000),
    },
  };
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parse_expires_at(value: unknown, now: Date): { ok: true; expiry: LinkExpiry } | { ok: false; status_code: 400; message: string } {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, status_code: 400, message: 'expires_at must be an ISO 8601 timestamp string' };
  }

  const expires_at = new Date(value);

  if (Number.isNaN(expires_at.getTime())) {
    return { ok: false, status_code: 400, message: 'expires_at must be a valid ISO 8601 timestamp' };
  }

  if (expires_at.getTime() <= now.getTime()) {
    return { ok: false, status_code: 400, message: 'expires_at must be in the future' };
  }

  return { ok: true, expiry: { is_permanent: false, expires_at } };
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

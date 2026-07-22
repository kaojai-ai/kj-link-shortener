import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import {
  build_link_opened_event,
  create_analytics_context,
  no_op_analytics_emitter,
  type AnalyticsContext,
} from './analytics.js';
import { render_admin_ui } from './admin-ui.js';
import { load_runtime_config } from './config.js';
import {
  create_short_link,
  fetch_metadata_safely,
  parse_link_expiry,
  to_link_expiry_update,
  type CreateLinkRequest,
} from './create-link.js';
import { DynamoDbLinkStore } from './dynamodb-link-store.js';
import { html_response, json_response, not_found_response, redirect_response } from './http.js';
import { DuplicateCodeError, is_link_active, type LinkStore } from './link-store.js';
import { fetch_link_metadata, type MetadataFetcher } from './metadata.js';
import { is_preview_crawler, render_preview_html } from './preview-html.js';
import { is_reserved_code, normalize_custom_code, validate_custom_code } from './short-code.js';
import { normalize_destination_url, validate_destination_url } from './url.js';

type Runtime = {
  store: LinkStore;
  api_key: string;
  default_ttl_days: number;
  analytics_context: AnalyticsContext;
};

let runtime_promise: Promise<Runtime> | null = null;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const runtime = await get_runtime();
  return handle_request(event, runtime.store, runtime.api_key, runtime.default_ttl_days, fetch_link_metadata, runtime.analytics_context);
}

export async function handle_request(
  event: APIGatewayProxyEventV2,
  link_store: LinkStore,
  api_key: string,
  default_ttl_days: number,
  metadata_fetcher: MetadataFetcher = fetch_link_metadata,
  analytics_context: AnalyticsContext = { emit_event: no_op_analytics_emitter },
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  const path = normalize_path(event.rawPath);

  if (method === 'GET' && (path === '/' || path === '/web' || path === '/web/')) {
    return html_response(200, render_admin_ui());
  }

  if (method === 'GET' && path === '/health') {
    return json_response(200, { ok: true });
  }

  if (method === 'GET' && path === '/robots.txt') {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
      body: 'User-agent: *\nAllow: /\n',
    };
  }

  if (path.startsWith('/api/')) {
    if (!is_authorized(event, api_key)) {
      return json_response(401, { error: 'Unauthorized' });
    }

    return handle_api_request(event, method, path, link_store, default_ttl_days, metadata_fetcher);
  }

  if (method === 'GET') {
    return handle_redirect(event, path, link_store, analytics_context);
  }

  return json_response(405, { error: 'Method not allowed' });
}

async function handle_api_request(
  event: APIGatewayProxyEventV2,
  method: string,
  path: string,
  link_store: LinkStore,
  default_ttl_days: number,
  metadata_fetcher: MetadataFetcher,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (method === 'POST' && path === '/api/links') {
    const parsed_body = parse_json_body(event.body);

    if (!parsed_body.ok) {
      return json_response(400, { error: parsed_body.message });
    }

    const result = await create_short_link(
      link_store,
      parsed_body.body as CreateLinkRequest,
      default_ttl_days,
      new Date(),
      metadata_fetcher,
    );

    if (!result.ok) {
      return json_response(result.status_code, { error: result.message });
    }

    return link_api_response(event, 201, result.link);
  }

  if (method === 'GET' && path === '/api/links') {
    const links = await link_store.list_recent_links(20);
    return json_response(200, { links: links.map((link) => link_api_body(event, link)) });
  }

  const link_path_match = path.match(/^\/api\/links\/([^/]+)$/);

  if (link_path_match && method === 'GET') {
    const link = await link_store.get_link(decodeURIComponent(link_path_match[1] ?? ''));

    if (!link) {
      return not_found_response();
    }

    return json_response(200, link);
  }

  if (link_path_match && method === 'PATCH') {
    const parsed_body = parse_json_body(event.body);

    if (!parsed_body.ok) {
      return json_response(400, { error: parsed_body.message });
    }

    const update_result = await update_link_url(
      link_store,
      decodeURIComponent(link_path_match[1] ?? ''),
      parsed_body.body,
      new Date(),
      default_ttl_days,
      metadata_fetcher,
    );

    if (!update_result.ok) {
      return json_response(update_result.status_code, { error: update_result.message });
    }

    return link_api_response(event, 200, update_result.link);
  }

  if (link_path_match && method === 'DELETE') {
    const disabled = await link_store.disable_link(decodeURIComponent(link_path_match[1] ?? ''), new Date());
    return disabled ? json_response(200, { ok: true }) : not_found_response();
  }

  return json_response(404, { error: 'Not found' });
}

async function handle_redirect(
  event: APIGatewayProxyEventV2,
  path: string,
  link_store: LinkStore,
  analytics_context: AnalyticsContext,
): Promise<APIGatewayProxyStructuredResultV2> {
  const code = decodeURIComponent(path.replace(/^\/+/, ''));

  if (!code || code.length < 3 || code.includes('/') || is_reserved_code(code)) {
    return not_found_response();
  }

  const link = await link_store.get_link(code);

  if (!link || !is_link_active(link, new Date())) {
    return not_found_response();
  }

  if (is_preview_crawler(get_header(event, 'user-agent'))) {
    return html_response(200, render_preview_html(link, build_short_url(event, code)));
  }

  const now = new Date();
  await link_store.record_visit(code, now);

  try {
    await analytics_context.emit_event(build_link_opened_event(
      event,
      link,
      now,
      analytics_context.ip_hash_salt,
    ));
  } catch (error) {
    console.warn('link_opened_event_emit_failed', {
      code,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  return redirect_response(link.destination_url);
}

function normalize_path(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

function is_authorized(event: APIGatewayProxyEventV2, api_key: string): boolean {
  const supplied_key = get_header(event, 'x-api-key');
  return supplied_key === api_key;
}

function build_short_url(event: APIGatewayProxyEventV2, code: string): string {
  const public_base_url = process.env.SHORTENER_PUBLIC_BASE_URL?.replace(/\/+$/, '');

  if (public_base_url) {
    return `${public_base_url}/${encodeURIComponent(code)}`;
  }

  const host = get_header(event, 'host') ?? event.requestContext.domainName;
  const protocol = get_header(event, 'x-forwarded-proto') ?? 'https';
  return `${protocol}://${host}/${encodeURIComponent(code)}`;
}

function get_header(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const lower_name = name.toLowerCase();
  const header_entry = Object.entries(event.headers).find(([key]) => key.toLowerCase() === lower_name);
  return header_entry?.[1];
}

async function update_link_url(
  link_store: LinkStore,
  code: string,
  body: unknown,
  now: Date,
  default_ttl_days: number,
  metadata_fetcher: MetadataFetcher,
): Promise<
  | { ok: true; link: NonNullable<Awaited<ReturnType<LinkStore['get_link']>>> }
  | { ok: false; status_code: 400 | 404 | 409; message: string }
> {
  if (!is_record(body) || (!Object.hasOwn(body, 'url') && !Object.hasOwn(body, 'code'))) {
    return { ok: false, status_code: 400, message: 'url or code is required' };
  }

  let link = await link_store.get_link(code);

  if (!link) {
    return { ok: false, status_code: 404, message: 'Not found' };
  }

  const has_expiry_update = Object.hasOwn(body, 'permanent') || Object.hasOwn(body, 'ttl_days') || Object.hasOwn(body, 'expires_at');
  const expiry_result = has_expiry_update
    ? parse_link_expiry(body as CreateLinkRequest, default_ttl_days, now)
    : undefined;

  if (expiry_result && !expiry_result.ok) {
    return expiry_result;
  }

  const expiry = expiry_result?.ok ? to_link_expiry_update(expiry_result.expiry) : undefined;

  if (Object.hasOwn(body, 'url')) {
    if (typeof body.url !== 'string') {
      return { ok: false, status_code: 400, message: 'url must be a string' };
    }

    const destination_url = normalize_destination_url(body.url);
    const url_error = validate_destination_url(destination_url);

    if (url_error) {
      return { ok: false, status_code: 400, message: url_error };
    }

    const metadata = await fetch_metadata_safely(metadata_fetcher, destination_url, now);
    link = await link_store.update_url(link.code, destination_url, metadata, now, expiry);

    if (!link) {
      return { ok: false, status_code: 404, message: 'Not found' };
    }
  }

  if (!Object.hasOwn(body, 'url') && expiry) {
    link = await link_store.update_url(link.code, link.destination_url, link.metadata, now, expiry);

    if (!link) {
      return { ok: false, status_code: 404, message: 'Not found' };
    }
  }

  if (Object.hasOwn(body, 'code')) {
    if (typeof body.code !== 'string') {
      return { ok: false, status_code: 400, message: 'code must be a string' };
    }

    const next_code = normalize_custom_code(body.code);
    const code_error = validate_custom_code(next_code);

    if (code_error) {
      return { ok: false, status_code: 400, message: code_error };
    }

    try {
      link = await link_store.update_code(link.code, next_code, now);
    } catch (error) {
      if (error instanceof DuplicateCodeError) {
        return { ok: false, status_code: 409, message: 'Code already exists' };
      }

      throw error;
    }
  }

  return link ? { ok: true, link } : { ok: false, status_code: 404, message: 'Not found' };
}

function link_api_response(
  event: APIGatewayProxyEventV2,
  status_code: number,
  link: NonNullable<Awaited<ReturnType<LinkStore['get_link']>>>,
): APIGatewayProxyStructuredResultV2 {
  return json_response(status_code, link_api_body(event, link));
}

function link_api_body(
  event: APIGatewayProxyEventV2,
  link: NonNullable<Awaited<ReturnType<LinkStore['get_link']>>>,
) {
  return {
    code: link.code,
    url: link.destination_url,
    destination_url: link.destination_url,
    short_url: build_short_url(event, link.code),
    created_at: link.created_at,
    updated_at: link.updated_at,
    expires_at: link.expires_at ?? null,
    permanent: link.is_permanent,
    metadata: link.metadata ?? null,
  };
}

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parse_json_body(body: string | undefined): { ok: true; body: unknown } | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: 'Request body is required' };
  }

  try {
    return { ok: true, body: JSON.parse(body) };
  } catch {
    return { ok: false, message: 'Request body must be valid JSON' };
  }
}

function get_runtime(): Promise<Runtime> {
  runtime_promise ??= load_runtime_config().then((loaded_config) => ({
    store: new DynamoDbLinkStore(loaded_config.table_name),
    api_key: loaded_config.api_key,
    default_ttl_days: loaded_config.default_ttl_days,
    analytics_context: create_analytics_context({
      delivery_stream_name: loaded_config.analytics_stream_name,
      ip_hash_salt: loaded_config.analytics_ip_hash_salt,
    }),
  }));

  return runtime_promise;
}

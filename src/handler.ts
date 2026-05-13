import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { load_runtime_config } from './config.js';
import { create_short_link, fetch_metadata_safely, type CreateLinkRequest } from './create-link.js';
import { DynamoDbLinkStore } from './dynamodb-link-store.js';
import { html_response, json_response, not_found_response, redirect_response } from './http.js';
import { is_link_active, type LinkStore } from './link-store.js';
import { fetch_link_metadata, type MetadataFetcher } from './metadata.js';
import { is_preview_crawler, render_preview_html } from './preview-html.js';
import { is_reserved_code } from './short-code.js';
import { normalize_destination_url, validate_destination_url } from './url.js';

type Runtime = {
  store: LinkStore;
  api_key: string;
  default_ttl_days: number;
};

let runtime_promise: Promise<Runtime> | null = null;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const runtime = await get_runtime();
  return handle_request(event, runtime.store, runtime.api_key, runtime.default_ttl_days);
}

export async function handle_request(
  event: APIGatewayProxyEventV2,
  link_store: LinkStore,
  api_key: string,
  default_ttl_days: number,
  metadata_fetcher: MetadataFetcher = fetch_link_metadata,
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  const path = normalize_path(event.rawPath);

  if (method === 'GET' && path === '/health') {
    return json_response(200, { ok: true });
  }

  if (path.startsWith('/api/')) {
    if (!is_authorized(event, api_key)) {
      return json_response(401, { error: 'Unauthorized' });
    }

    return handle_api_request(event, method, path, link_store, default_ttl_days, metadata_fetcher);
  }

  if (method === 'GET') {
    return handle_redirect(event, path, link_store);
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

    return json_response(201, {
      code: result.link.code,
      url: result.link.destination_url,
      short_url: build_short_url(event, result.link.code),
      expires_at: result.link.expires_at ?? null,
      permanent: result.link.is_permanent,
      metadata: result.link.metadata ?? null,
    });
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
      metadata_fetcher,
    );

    if (!update_result.ok) {
      return json_response(update_result.status_code, { error: update_result.message });
    }

    return json_response(200, update_result.link);
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
): Promise<APIGatewayProxyStructuredResultV2> {
  const code = decodeURIComponent(path.replace(/^\/+/, ''));

  if (!code || code.includes('/') || is_reserved_code(code)) {
    return not_found_response();
  }

  const link = await link_store.get_link(code);

  if (!link || !is_link_active(link, new Date())) {
    return not_found_response();
  }

  if (is_preview_crawler(get_header(event, 'user-agent'))) {
    return html_response(200, render_preview_html(link, build_short_url(event, code)));
  }

  await link_store.record_visit(code, new Date());
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
  metadata_fetcher: MetadataFetcher,
): Promise<
  | { ok: true; link: NonNullable<Awaited<ReturnType<LinkStore['get_link']>>> }
  | { ok: false; status_code: 400 | 404; message: string }
> {
  if (!is_record(body) || !Object.hasOwn(body, 'url')) {
    return { ok: false, status_code: 400, message: 'url is required' };
  }

  if (typeof body.url !== 'string') {
    return { ok: false, status_code: 400, message: 'url must be a string' };
  }

  const destination_url = normalize_destination_url(body.url);
  const url_error = validate_destination_url(destination_url);

  if (url_error) {
    return { ok: false, status_code: 400, message: url_error };
  }

  const metadata = await fetch_metadata_safely(metadata_fetcher, destination_url, now);
  const link = await link_store.update_url(code, destination_url, metadata, now);
  return link ? { ok: true, link } : { ok: false, status_code: 404, message: 'Not found' };
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
  }));

  return runtime_promise;
}

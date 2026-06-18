import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';
import type { OwnerContext, ShortLink } from './link-store.js';

const LINK_OPENED_SCHEMA_VERSION = 'link_opened.v1';
const ANALYTICS_EMIT_TIMEOUT_MS = 750;

export type LinkOpenedEventV1 = {
  schema_version: typeof LINK_OPENED_SCHEMA_VERSION;
  opened_at: string;
  short_code: string;
  destination_url: string;
  tenant_id?: string;
  owner_source_kind: OwnerContext['source_kind'];
  owner_source_id?: string;
  created_by_user_id?: string;
  referer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  user_agent?: string;
  request_host?: string;
  request_path: string;
  raw_query_string?: string;
  viewer_country?: string;
  ip_hash?: string;
};

export type AnalyticsEmitter = (event: LinkOpenedEventV1) => Promise<void>;

export type AnalyticsContext = {
  emit_event: AnalyticsEmitter;
  ip_hash_salt?: string;
};

export const no_op_analytics_emitter: AnalyticsEmitter = async () => undefined;

export function create_analytics_context(input: {
  delivery_stream_name?: string;
  ip_hash_salt?: string;
}): AnalyticsContext {
  if (!input.delivery_stream_name) {
    return {
      emit_event: no_op_analytics_emitter,
      ...(input.ip_hash_salt ? { ip_hash_salt: input.ip_hash_salt } : {}),
    };
  }

  return {
    emit_event: create_firehose_analytics_emitter(input.delivery_stream_name),
    ...(input.ip_hash_salt ? { ip_hash_salt: input.ip_hash_salt } : {}),
  };
}

export function build_link_opened_event(
  event: APIGatewayProxyEventV2,
  link: ShortLink,
  opened_at: Date,
  ip_hash_salt?: string,
): LinkOpenedEventV1 {
  const destination = new URL(link.destination_url);
  const owner_context = link.owner_context;
  const caller_ip = get_caller_ip(event);

  return {
    schema_version: LINK_OPENED_SCHEMA_VERSION,
    opened_at: opened_at.toISOString(),
    short_code: link.code,
    destination_url: link.destination_url,
    ...(owner_context?.tenant_id ? { tenant_id: owner_context.tenant_id } : {}),
    owner_source_kind: owner_context?.source_kind ?? 'unknown',
    ...(owner_context?.source_id ? { owner_source_id: owner_context.source_id } : {}),
    ...(owner_context?.created_by_user_id ? { created_by_user_id: owner_context.created_by_user_id } : {}),
    ...(destination.searchParams.get('utm_source') ? { utm_source: destination.searchParams.get('utm_source') ?? undefined } : {}),
    ...(destination.searchParams.get('utm_medium') ? { utm_medium: destination.searchParams.get('utm_medium') ?? undefined } : {}),
    ...(destination.searchParams.get('utm_campaign') ? { utm_campaign: destination.searchParams.get('utm_campaign') ?? undefined } : {}),
    ...(destination.searchParams.get('utm_content') ? { utm_content: destination.searchParams.get('utm_content') ?? undefined } : {}),
    ...(destination.searchParams.get('utm_term') ? { utm_term: destination.searchParams.get('utm_term') ?? undefined } : {}),
    ...(get_header(event, 'referer') ? { referer: get_header(event, 'referer') } : {}),
    ...(get_header(event, 'user-agent') ? { user_agent: get_header(event, 'user-agent') } : {}),
    ...(get_header(event, 'host') ?? event.requestContext.domainName
      ? { request_host: get_header(event, 'host') ?? event.requestContext.domainName }
      : {}),
    request_path: event.rawPath,
    ...(event.rawQueryString ? { raw_query_string: event.rawQueryString } : {}),
    ...(get_header(event, 'cloudfront-viewer-country') ? { viewer_country: get_header(event, 'cloudfront-viewer-country') } : {}),
    ...(caller_ip && ip_hash_salt ? { ip_hash: create_ip_hash(caller_ip, ip_hash_salt) } : {}),
  };
}

function create_firehose_analytics_emitter(delivery_stream_name: string): AnalyticsEmitter {
  const client = new FirehoseClient({
    maxAttempts: 1,
  });

  return async (event) => {
    const abort_controller = new AbortController();
    const timeout = setTimeout(() => {
      abort_controller.abort();
    }, ANALYTICS_EMIT_TIMEOUT_MS);

    try {
      await client.send(new PutRecordCommand({
        DeliveryStreamName: delivery_stream_name,
        Record: {
          Data: Buffer.from(`${JSON.stringify(event)}\n`),
        },
      }), {
        abortSignal: abort_controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function create_ip_hash(caller_ip: string, ip_hash_salt: string): string {
  return createHash('sha256')
    .update(`${ip_hash_salt}:${caller_ip}`)
    .digest('hex');
}

function get_caller_ip(event: APIGatewayProxyEventV2): string | undefined {
  const forwarded_for = get_header(event, 'x-forwarded-for');

  if (forwarded_for) {
    const [first_ip] = forwarded_for.split(',');
    const trimmed_ip = first_ip?.trim();

    if (trimmed_ip) {
      return trimmed_ip;
    }
  }

  return event.requestContext.http.sourceIp || undefined;
}

function get_header(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const lower_name = name.toLowerCase();
  const header_entry = Object.entries(event.headers).find(([key]) => key.toLowerCase() === lower_name);
  return header_entry?.[1];
}

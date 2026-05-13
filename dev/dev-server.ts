import { randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handle_request } from '../src/handler.js';
import { MemoryLinkStore } from './memory-link-store.js';

const DEFAULT_PORT = 8787;
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.SHORTENER_DEV_API_KEY || 'dev-api-key';
const DEFAULT_TTL_DAYS = Number(process.env.SHORTENER_DEFAULT_TTL_DAYS || '30');
const store = new MemoryLinkStore();

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/__dev/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      response.write(': connected\n\n');
      return;
    }

    const event = await to_lambda_event(request);
    const result = await handle_request(event, store, API_KEY, DEFAULT_TTL_DAYS);
    write_response(response, result);
  } catch (error) {
    console.error('dev_server_request_failed', error);
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Internal server error');
  }
});

server.listen(get_port(), HOST, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : get_port();

  console.log(`kj-link-shortener dev server running at http://${HOST}:${port}`);
  console.log(`API key: ${API_KEY}`);
});

function get_port(): number {
  const raw_port = process.env.PORT;

  if (!raw_port) {
    return DEFAULT_PORT;
  }

  const parsed_port = Number(raw_port);

  if (!Number.isInteger(parsed_port) || parsed_port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return parsed_port;
}

async function to_lambda_event(request: IncomingMessage): Promise<APIGatewayProxyEventV2> {
  const host = get_header(request.headers, 'host') || 'localhost';
  const url = new URL(request.url || '/', `http://${host}`);
  const method = request.method || 'GET';

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    headers: normalize_headers(request.headers),
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: host,
      domainPrefix: host.split('.')[0] || 'local',
      http: {
        method,
        path: url.pathname,
        protocol: `HTTP/${request.httpVersion}`,
        sourceIp: request.socket.remoteAddress || '127.0.0.1',
        userAgent: get_header(request.headers, 'user-agent') || 'local',
      },
      requestId: randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: new Date().toUTCString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    body: await read_body(request),
  };
}

function normalize_headers(headers: IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
  );
}

function get_header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function read_body(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      resolve(chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined);
    });
    request.on('error', reject);
  });
}

function write_response(response: ServerResponse, result: APIGatewayProxyStructuredResultV2): void {
  const status_code = result.statusCode || 200;
  const headers = result.headers || {};

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      response.setHeader(key, typeof value === 'boolean' ? String(value) : value);
    }
  }

  response.writeHead(status_code);
  response.end(result.body);
}

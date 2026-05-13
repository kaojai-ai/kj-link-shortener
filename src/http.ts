import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function json_response(status_code: number, body: JsonValue): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status_code,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export function not_found_response(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: 'Not found',
  };
}

export function redirect_response(destination_url: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 302,
    headers: {
      location: destination_url,
      'cache-control': 'no-store',
    },
  };
}

export function html_response(status_code: number, body: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status_code,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
    body,
  };
}

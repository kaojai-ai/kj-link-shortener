import { bootstrap_aws_runtime_config } from '@kaojai-ai/platform-lib/runtime-config';

type Handler = typeof import('./handler.js').handler;

let handler_promise: Promise<Handler> | null = null;

function load_handler(): Promise<Handler> {
  if (!handler_promise) {
    handler_promise = bootstrap_aws_runtime_config({ app_name: 'kj-link-shortener' })
      .then(async () => (await import('./handler.js')).handler);
  }
  return handler_promise;
}

export async function handler(...args: Parameters<Handler>): Promise<Awaited<ReturnType<Handler>>> {
  return (await load_handler())(...args);
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { load_config } from '../src/config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('load_config', () => {
  it('loads non-secret config and canonical bundle keys', () => {
    vi.stubEnv('SHORTENER_TABLE_NAME', 'short-links');
    vi.stubEnv('SHORTENER_DEFAULT_TTL_DAYS', '45');
    vi.stubEnv('SHORTENER_ANALYTICS_STREAM_NAME', 'link-events');
    vi.stubEnv('KJ_LINK_SHORTENER_API_KEY', 'api-key');
    vi.stubEnv('KJ_LINK_SHORTENER_ANALYTICS_IP_HASH_SALT', 'hash-salt');

    expect(load_config()).toEqual({
      table_name: 'short-links',
      api_key: 'api-key',
      default_ttl_days: 45,
      analytics_stream_name: 'link-events',
      analytics_ip_hash_salt: 'hash-salt',
    });
  });

  it('does not accept the retired standalone API key environment variable', () => {
    vi.stubEnv('SHORTENER_TABLE_NAME', 'short-links');
    vi.stubEnv('SHORTENER_API_KEY', 'legacy-api-key');
    vi.stubEnv('KJ_LINK_SHORTENER_API_KEY', '');

    expect(() => load_config()).toThrow('Missing required environment variable KJ_LINK_SHORTENER_API_KEY');
  });
});

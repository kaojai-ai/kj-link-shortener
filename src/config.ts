export type AppConfig = {
  table_name: string;
  api_key: string;
  default_ttl_days: number;
  analytics_stream_name?: string;
  analytics_ip_hash_salt?: string;
};

function required_env(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value.trim();
}

function number_env(name: string, default_value: number): number {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    return default_value;
  }

  const parsed_value = Number(value);

  if (!Number.isInteger(parsed_value) || parsed_value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed_value;
}

export function load_config(): AppConfig {
  return {
    table_name: required_env('SHORTENER_TABLE_NAME'),
    api_key: required_env('KJ_LINK_SHORTENER_API_KEY'),
    default_ttl_days: number_env('SHORTENER_DEFAULT_TTL_DAYS', 30),
    analytics_stream_name: optional_env('SHORTENER_ANALYTICS_STREAM_NAME'),
    analytics_ip_hash_salt: optional_env('KJ_LINK_SHORTENER_ANALYTICS_IP_HASH_SALT'),
  };
}

export async function load_runtime_config(): Promise<AppConfig> {
  return load_config();
}

function optional_env(name: string): string | undefined {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

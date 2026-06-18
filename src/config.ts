import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

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
    api_key: required_env('SHORTENER_API_KEY'),
    default_ttl_days: number_env('SHORTENER_DEFAULT_TTL_DAYS', 30),
    analytics_stream_name: optional_env('SHORTENER_ANALYTICS_STREAM_NAME'),
    analytics_ip_hash_salt: optional_env('SHORTENER_ANALYTICS_IP_HASH_SALT'),
  };
}

export async function load_runtime_config(): Promise<AppConfig> {
  const [
    api_key,
    analytics_ip_hash_salt,
  ] = await Promise.all([
    load_secret_backed_value({
      direct_env_name: 'SHORTENER_API_KEY',
      secret_id_env_name: 'SHORTENER_API_KEY_SECRET_ID',
      missing_value_error: 'Missing SHORTENER_API_KEY or SHORTENER_API_KEY_SECRET_ID',
      empty_secret_error: 'SHORTENER_API_KEY_SECRET_ID must point to a non-empty string secret',
    }),
    load_optional_secret_backed_value({
      direct_env_name: 'SHORTENER_ANALYTICS_IP_HASH_SALT',
      secret_id_env_name: 'SHORTENER_ANALYTICS_IP_HASH_SALT_SECRET_ID',
    }),
  ]);

  return {
    table_name: required_env('SHORTENER_TABLE_NAME'),
    api_key,
    default_ttl_days: number_env('SHORTENER_DEFAULT_TTL_DAYS', 30),
    analytics_stream_name: optional_env('SHORTENER_ANALYTICS_STREAM_NAME'),
    ...(analytics_ip_hash_salt ? { analytics_ip_hash_salt } : {}),
  };
}

function optional_env(name: string): string | undefined {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

async function load_secret_backed_value(input: {
  direct_env_name: string;
  secret_id_env_name: string;
  missing_value_error: string;
  empty_secret_error: string;
}): Promise<string> {
  const env_value = optional_env(input.direct_env_name);

  if (env_value) {
    return env_value;
  }

  const secret_id = optional_env(input.secret_id_env_name);

  if (!secret_id) {
    throw new Error(input.missing_value_error);
  }

  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({
    SecretId: secret_id,
  }));

  if (!result.SecretString || result.SecretString.trim() === '') {
    throw new Error(input.empty_secret_error);
  }

  return result.SecretString.trim();
}

async function load_optional_secret_backed_value(input: {
  direct_env_name: string;
  secret_id_env_name: string;
}): Promise<string | undefined> {
  const env_value = optional_env(input.direct_env_name);

  if (env_value) {
    return env_value;
  }

  const secret_id = optional_env(input.secret_id_env_name);

  if (!secret_id) {
    return undefined;
  }

  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({
    SecretId: secret_id,
  }));

  if (!result.SecretString || result.SecretString.trim() === '') {
    throw new Error(`${input.secret_id_env_name} must point to a non-empty string secret`);
  }

  return result.SecretString.trim();
}

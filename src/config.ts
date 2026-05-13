import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export type AppConfig = {
  table_name: string;
  api_key: string;
  default_ttl_days: number;
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
  };
}

export async function load_runtime_config(): Promise<AppConfig> {
  return {
    table_name: required_env('SHORTENER_TABLE_NAME'),
    api_key: await load_api_key(),
    default_ttl_days: number_env('SHORTENER_DEFAULT_TTL_DAYS', 30),
  };
}

async function load_api_key(): Promise<string> {
  const env_api_key = process.env.SHORTENER_API_KEY;

  if (env_api_key && env_api_key.trim() !== '') {
    return env_api_key.trim();
  }

  const secret_id = process.env.SHORTENER_API_KEY_SECRET_ID;

  if (!secret_id || secret_id.trim() === '') {
    throw new Error('Missing SHORTENER_API_KEY or SHORTENER_API_KEY_SECRET_ID');
  }

  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({
    SecretId: secret_id.trim(),
  }));

  if (!result.SecretString || result.SecretString.trim() === '') {
    throw new Error('SHORTENER_API_KEY_SECRET_ID must point to a non-empty string secret');
  }

  return result.SecretString.trim();
}

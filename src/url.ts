export function normalize_destination_url(value: string): string {
  return value.trim();
}

export function validate_destination_url(value: string): string | null {
  let parsed_url: URL;

  try {
    parsed_url = new URL(value);
  } catch {
    return 'URL must be absolute';
  }

  if (parsed_url.protocol !== 'http:' && parsed_url.protocol !== 'https:') {
    return 'URL protocol must be http or https';
  }

  if (!parsed_url.hostname) {
    return 'URL must include a hostname';
  }

  return null;
}

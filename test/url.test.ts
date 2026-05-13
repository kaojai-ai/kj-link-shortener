import { describe, expect, it } from 'vitest';
import { normalize_destination_url, validate_destination_url } from '../src/url.js';

describe('URL helpers', () => {
  it('accepts http and https URLs', () => {
    expect(validate_destination_url('https://example.org/path')).toBeNull();
    expect(validate_destination_url('http://example.org/path')).toBeNull();
  });

  it('rejects invalid or unsupported URLs', () => {
    expect(validate_destination_url('example.org')).toBe('URL must be absolute');
    expect(validate_destination_url('ftp://example.org')).toBe('URL protocol must be http or https');
  });

  it('trims destination URLs', () => {
    expect(normalize_destination_url(' https://example.org ')).toBe('https://example.org');
  });
});

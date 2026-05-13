import { describe, expect, it } from 'vitest';
import {
  generate_code,
  is_reserved_code,
  normalize_custom_code,
  validate_custom_code,
} from '../src/short-code.js';

describe('short code helpers', () => {
  it('generates 6-character base62 codes by default', () => {
    const code = generate_code();

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
  });

  it('validates custom codes', () => {
    expect(validate_custom_code('abc')).toBeNull();
    expect(validate_custom_code('abc_123-XYZ')).toBeNull();
    expect(validate_custom_code('ab')).toBe('Code must match [A-Za-z0-9_-]{3,64}');
    expect(validate_custom_code('bad/code')).toBe('Code must match [A-Za-z0-9_-]{3,64}');
  });

  it('rejects reserved codes case-insensitively', () => {
    expect(validate_custom_code('api')).toBe('Code is reserved');
    expect(validate_custom_code('ADMIN')).toBe('Code is reserved');
    expect(is_reserved_code('Health')).toBe(true);
  });

  it('normalizes custom code whitespace only', () => {
    expect(normalize_custom_code(' docs ')).toBe('docs');
  });
});

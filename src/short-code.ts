import { randomInt } from 'node:crypto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CUSTOM_CODE_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const RESERVED_CODES = new Set(['api', 'health', 'admin', 'www']);

export function generate_code(length = 6): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('Code length must be a positive integer');
  }

  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += BASE62_ALPHABET[randomInt(BASE62_ALPHABET.length)];
  }

  return code;
}

export function normalize_custom_code(code: string): string {
  return code.trim();
}

export function validate_custom_code(code: string): string | null {
  if (!CUSTOM_CODE_PATTERN.test(code)) {
    return 'Code must match [A-Za-z0-9_-]{3,64}';
  }

  if (RESERVED_CODES.has(code.toLowerCase())) {
    return 'Code is reserved';
  }

  return null;
}

export function is_reserved_code(code: string): boolean {
  return RESERVED_CODES.has(code.toLowerCase());
}

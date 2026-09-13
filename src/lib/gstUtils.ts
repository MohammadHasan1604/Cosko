/**
 * Unified Indian Goods and Services Tax Identification Number (GSTIN) utility.
 * Format: 15 alphanumeric characters
 * 1-2: 2-digit State Code (01-38, 97, 99)
 * 3-7: 5 letters (PAN Alphabets)
 * 8-11: 4 digits (PAN Numbers)
 * 12: 1 letter (PAN Check Character)
 * 13: 1 alphanumeric (Entity code: 1-9 or A-Z)
 * 14: Default 'Z' or alphanumeric
 * 15: 1 alphanumeric check character
 * 
 * Unregistered / Exempt / Optional representations:
 * Blank / empty string, whitespace, null, undefined, or explicitly unregistered
 * markers like 'URP', 'NA', 'N/A', 'NONE', 'EXEMPT', 'PENDING', 'UNREGISTERED'.
 */

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z0-9A-Z]{1}[0-9A-Z]{1}$/;

const UNREGISTERED_SET = new Set([
  '',
  'URP',
  'NA',
  'N/A',
  'NONE',
  'EXEMPT',
  'PENDING',
  'UNREGISTERED',
  'NOT APPLICABLE',
  'NOT_APPLICABLE',
]);

export interface GstinValidationResult {
  isValid: boolean;
  normalized: string;
  isOptionalOrUnregistered: boolean;
  error?: string;
}

/**
 * Validates and normalizes GSTIN inputs for vendors, customers, or company profile.
 * Does not block optional/unregistered vendor saves.
 */
export function validateAndNormalizeGstin(input?: string | null): GstinValidationResult {
  if (input === undefined || input === null) {
    return {
      isValid: true,
      normalized: '',
      isOptionalOrUnregistered: true,
    };
  }

  const raw = String(input).trim().toUpperCase();

  // If blank or designated as unregistered / pending / exempt
  if (raw === '' || UNREGISTERED_SET.has(raw)) {
    const normalized = raw === 'PENDING' ? 'PENDING' : (raw === 'URP' ? 'URP' : '');
    return {
      isValid: true,
      normalized,
      isOptionalOrUnregistered: true,
    };
  }

  // Strip hyphens, spaces, and slashes that users commonly enter
  const cleanGstin = raw.replace(/[\s\-_/]/g, '');

  if (cleanGstin.length !== 15) {
    return {
      isValid: false,
      normalized: cleanGstin,
      isOptionalOrUnregistered: false,
      error: `GSTIN must be 15 characters (entered ${cleanGstin.length}). For unregistered suppliers, leave blank or enter URP.`,
    };
  }

  if (!GSTIN_REGEX.test(cleanGstin)) {
    return {
      isValid: false,
      normalized: cleanGstin,
      isOptionalOrUnregistered: false,
      error: 'Invalid GSTIN structure. Expected: 2-digit State Code + 10-char PAN + Entity Code + Z + Check Digit (e.g. 29AABCS1429B1ZB).',
    };
  }

  return {
    isValid: true,
    normalized: cleanGstin,
    isOptionalOrUnregistered: false,
  };
}

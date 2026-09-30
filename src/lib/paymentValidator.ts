/**
 * Authoritative Canonical Payment Method Validator
 *
 * Strict business requirement:
 * Operational payment transactions across COSKO must accept EXACTLY:
 * - 'Cash'
 * - 'UPI'
 * - 'Other'
 *
 * Arbitrary or non-approved payment methods (e.g. 'Crypto', 'Cheque', etc.) must be rejected with 400.
 * Historical legacy transaction strings remain immutable.
 */

export const ALLOWED_PAYMENT_METHODS = ['Cash', 'UPI', 'Other'] as const;
export type AllowedPaymentMethod = (typeof ALLOWED_PAYMENT_METHODS)[number];

export interface PaymentValidationResult {
  valid: boolean;
  normalized?: AllowedPaymentMethod;
  error?: string;
}

export function validatePaymentMethod(method: unknown): PaymentValidationResult {
  if (!method || typeof method !== 'string') {
    return {
      valid: false,
      error: 'Payment method is required and must be one of: Cash, UPI, Other.',
    };
  }

  const trimmed = method.trim();
  const match = ALLOWED_PAYMENT_METHODS.find(
    (allowed) => allowed.toLowerCase() === trimmed.toLowerCase()
  );

  if (!match) {
    return {
      valid: false,
      error: `Invalid payment method "${trimmed}". Operational transactions must strictly use one of: Cash, UPI, Other.`,
    };
  }

  return {
    valid: true,
    normalized: match,
  };
}

export function isAllowedPaymentMethod(method: unknown): method is AllowedPaymentMethod {
  return validatePaymentMethod(method).valid;
}

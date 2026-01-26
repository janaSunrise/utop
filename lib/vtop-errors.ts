/**
 * VTOP Error Handling Infrastructure
 * Standardized error codes and error class for VTOP API operations
 */

/** Error codes for VTOP operations */
export const VTOPErrorCodes = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_CAPTCHA: 'INVALID_CAPTCHA',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  MISSING_REGISTRATION: 'MISSING_REGISTRATION',
  VTOP_ERROR: 'VTOP_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type VTOPErrorCode = typeof VTOPErrorCodes[keyof typeof VTOPErrorCodes];

/** HTTP status codes mapped to error codes */
export const ErrorHttpStatus: Record<VTOPErrorCode, number> = {
  [VTOPErrorCodes.SESSION_EXPIRED]: 401,
  [VTOPErrorCodes.INVALID_CREDENTIALS]: 401,
  [VTOPErrorCodes.INVALID_CAPTCHA]: 400,
  [VTOPErrorCodes.NETWORK_ERROR]: 503,
  [VTOPErrorCodes.PARSE_ERROR]: 500,
  [VTOPErrorCodes.UNAUTHORIZED]: 401,
  [VTOPErrorCodes.MISSING_REGISTRATION]: 400,
  [VTOPErrorCodes.VTOP_ERROR]: 502,
  [VTOPErrorCodes.TIMEOUT]: 504,
};

/** User-friendly error messages for each error code */
export const ErrorMessages: Record<VTOPErrorCode, string> = {
  [VTOPErrorCodes.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [VTOPErrorCodes.INVALID_CREDENTIALS]: 'Invalid username or password.',
  [VTOPErrorCodes.INVALID_CAPTCHA]: 'Invalid CAPTCHA. Please try again.',
  [VTOPErrorCodes.NETWORK_ERROR]: 'Could not connect to VTOP. Please try again.',
  [VTOPErrorCodes.PARSE_ERROR]: 'Failed to parse VTOP response.',
  [VTOPErrorCodes.UNAUTHORIZED]: 'Not authenticated. Please log in.',
  [VTOPErrorCodes.MISSING_REGISTRATION]: 'Registration number is required.',
  [VTOPErrorCodes.VTOP_ERROR]: 'VTOP returned an error. Please try again.',
  [VTOPErrorCodes.TIMEOUT]: 'Request timed out. Please try again.',
};

/**
 * Custom error class for VTOP operations
 */
export class VTOPError extends Error {
  readonly code: VTOPErrorCode;
  readonly httpStatus: number;
  readonly originalError?: Error;

  constructor(code: VTOPErrorCode, message?: string, originalError?: Error) {
    super(message || ErrorMessages[code]);
    this.name = 'VTOPError';
    this.code = code;
    this.httpStatus = ErrorHttpStatus[code];
    this.originalError = originalError;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VTOPError);
    }
  }

  /**
   * Create a VTOPError from an unknown error
   */
  static from(error: unknown): VTOPError {
    if (error instanceof VTOPError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Map known error messages to error codes
      if (message === 'session_expired' || message.includes('session expired')) {
        return new VTOPError(VTOPErrorCodes.SESSION_EXPIRED, undefined, error);
      }
      if (message.includes('invalid captcha') || message.includes('captcha')) {
        return new VTOPError(VTOPErrorCodes.INVALID_CAPTCHA, undefined, error);
      }
      if (message.includes('invalid user') || message.includes('invalid password') || message.includes('credentials')) {
        return new VTOPError(VTOPErrorCodes.INVALID_CREDENTIALS, undefined, error);
      }
      if (message.includes('fetch') || message.includes('network') || message.includes('econnreset')) {
        return new VTOPError(VTOPErrorCodes.NETWORK_ERROR, undefined, error);
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return new VTOPError(VTOPErrorCodes.TIMEOUT, undefined, error);
      }
      if (message.includes('registration')) {
        return new VTOPError(VTOPErrorCodes.MISSING_REGISTRATION, undefined, error);
      }
      if (message.startsWith('vtop_error')) {
        return new VTOPError(VTOPErrorCodes.VTOP_ERROR, error.message, error);
      }

      // Default to VTOP_ERROR for unrecognized errors
      return new VTOPError(VTOPErrorCodes.VTOP_ERROR, error.message, error);
    }

    // Unknown error type
    return new VTOPError(VTOPErrorCodes.VTOP_ERROR, String(error));
  }

  /**
   * Check if error indicates session needs refresh
   */
  requiresReauth(): boolean {
    return this.code === VTOPErrorCodes.SESSION_EXPIRED || this.code === VTOPErrorCodes.UNAUTHORIZED;
  }

  /**
   * Convert to plain object for JSON response
   */
  toJSON(): { code: VTOPErrorCode; message: string } {
    return {
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Check if an error requires session refresh
 */
export function requiresReauth(error: unknown): boolean {
  if (error instanceof VTOPError) {
    return error.requiresReauth();
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message === 'session_expired' || message.includes('session expired');
  }
  return false;
}

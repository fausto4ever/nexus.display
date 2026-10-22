const SCREEN_IDENTITY_ERRORS = new Set(['SCREEN_AUTH_REQUIRED', 'SCREEN_AUTH_INVALID', 'SCREEN_NOT_FOUND']);

// Only an explicit screen-identity rejection may trigger re-enrollment.
// Timeouts, 503s and transport failures preserve the enrolled identity.
export function isScreenIdentityRejected(code) {
  return SCREEN_IDENTITY_ERRORS.has(code);
}

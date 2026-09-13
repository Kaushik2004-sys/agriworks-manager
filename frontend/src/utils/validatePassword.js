// Shared strong-password check (mirrors backend accounts/validators.py).
// Rule: min 8 chars + at least 1 uppercase, 1 lowercase, 1 number,
// 1 special character. Login never uses this so older passwords keep working.
export const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.';

export const PASSWORD_HINT =
  'Min 8 characters with uppercase, lowercase, number and special character.';

export function passwordError(value) {
  if (!value) return 'Password is required.';
  if (
    value.length < 8 ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  ) {
    return PASSWORD_MESSAGE;
  }
  return '';
}

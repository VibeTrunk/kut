// Members sign up and sign in with a self-chosen username, not an email.
// Supabase Auth still needs an address, so a username maps 1:1 to a synthetic
// address on a non-routable domain. No mail is ever sent there (accounts are
// created with email_confirm and recovery is admin-assisted).
//
// The username is a login handle only — the public display name stays the
// linked player's real name.

export const USERNAME_EMAIL_DOMAIN = "users.kut.local";
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}

export function usernameToEmail(value: string): string {
  return `${normalizeUsername(value)}@${USERNAME_EMAIL_DOMAIN}`;
}

/**
 * Accepts either a username or (for accounts created before usernames existed)
 * a raw email address, and returns the address to hand to Supabase Auth.
 */
export function loginIdentifierToEmail(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : usernameToEmail(trimmed);
}

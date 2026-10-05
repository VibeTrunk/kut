import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

// Only a rejected sign-in is the member's to fix by retyping (KB-039). A request
// that never reached Supabase Auth, or a 5xx from it, arrives as an
// AuthRetryableFetchError; blaming the password there sends a member with the
// right password hunting for a typo. A 429 is Auth's rate limit, not a wrong
// password either.
export function signInErrorMessage(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) {
    return "Couldn't reach KUT. Check your connection and try again.";
  }
  if (error.status === 429) {
    return "Too many sign-in attempts. Wait a minute and try again.";
  }
  return "Sign-in failed. Check your username and password.";
}

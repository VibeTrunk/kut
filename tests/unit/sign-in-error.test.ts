import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { BRAND } from "@/lib/brand";
import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "@/lib/auth/sign-in-error";

const credentials = "Sign-in failed. Check your username and password.";
const unreachable = `Couldn't reach ${BRAND.shortName}. Check your connection and try again.`;

describe("sign-in error message (KB-039)", () => {
  it("blames the credentials only when Auth rejected them", () => {
    expect(
      signInErrorMessage(new AuthApiError("Invalid login credentials", 400, "invalid_credentials")),
    ).toBe(credentials);
  });

  it("says the server was unreachable for a request that never arrived", () => {
    // supabase-js reports a failed fetch, such as net::ERR_NO_BUFFER_SPACE, with status 0.
    expect(signInErrorMessage(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(unreachable);
  });

  it("says the server was unreachable for a gateway or server error", () => {
    expect(signInErrorMessage(new AuthRetryableFetchError("Bad Gateway", 502))).toBe(unreachable);
  });

  it("names the rate limit rather than the password", () => {
    expect(
      signInErrorMessage(
        new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
      ),
    ).toBe("Too many sign-in attempts. Wait a minute and try again.");
  });
});

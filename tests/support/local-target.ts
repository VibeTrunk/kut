// Every database-backed suite in this repository writes to, and in the case of
// the authenticated browser fixtures *deletes* from, whatever host its
// connection string names. The defaults are the local Supabase stack, but they
// are all `process.env.X ?? <loopback default>` — so an operator who happens to
// have hosted values exported (the production release gate itself requires
// API_URL / DB_URL / SERVICE_ROLE_KEY to be set) would silently point the
// fixtures at production.
//
// These guards make that impossible by accident. A non-loopback target is
// refused unless the operator sets KUT_ALLOW_NONLOCAL_TEST_TARGET to the exact
// acknowledgement phrase below. CI never sets it, and no repository script
// sets it.

const OVERRIDE_ENV = "KUT_ALLOW_NONLOCAL_TEST_TARGET";
const OVERRIDE_PHRASE = "yes-i-am-writing-to-that-database";

function isLoopbackHost(hostname: string): boolean {
  // URL.hostname keeps IPv6 literals in brackets.
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function overrideAccepted(): boolean {
  return process.env[OVERRIDE_ENV] === OVERRIDE_PHRASE;
}

/**
 * Throws unless `target` points at loopback. `label` names the environment
 * variable the caller read, so the failure says which value to fix.
 */
export function assertLocalTarget(target: string, label: string): string {
  let hostname: string;
  try {
    hostname = new URL(target).hostname;
  } catch {
    throw new Error(`${label} is not a parsable URL, so its target cannot be proven local.`);
  }
  if (!hostname) {
    throw new Error(`${label} names no host, so its target cannot be proven local.`);
  }
  if (isLoopbackHost(hostname) || overrideAccepted()) return target;
  // Deliberately prints only the host: a connection string carries a password.
  throw new Error(
    `Refusing to run destructive test fixtures against non-loopback host '${hostname}' ` +
      `(from ${label}). These suites create and delete users and rows. If this really is a ` +
      `throwaway database, set ${OVERRIDE_ENV}=${OVERRIDE_PHRASE}.`,
  );
}

/** The local-stack Postgres URL, guarded. */
export function localDatabaseUrl(): string {
  const url =
    process.env.KUT_LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  return assertLocalTarget(
    url,
    process.env.KUT_LOCAL_DATABASE_URL ? "KUT_LOCAL_DATABASE_URL" : "the built-in default",
  );
}

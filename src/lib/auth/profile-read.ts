// Every signed-in page reads the member's own profile before rendering. A
// missing or disabled profile means "not a member": the guards redirect. A
// failed read means nothing about membership, and redirecting it to /login
// made a transient database-API failure look like being signed out, with no
// message and no log line (KB-040). It throws instead, so the route error
// page offers "Try again", and logs the PostgREST code for the operator.
export const MEMBERSHIP_READ_FAILED = "Could not verify your FLUT membership.";

export function enabledProfile<T extends { is_disabled: boolean }>(
  response: { data: T | null; error: { code: string } | null },
  guard: string,
): T | null {
  if (response.error) {
    console.error("profile read failed", { guard, code: response.error.code });
    throw new Error(MEMBERSHIP_READ_FAILED);
  }
  return response.data && !response.data.is_disabled ? response.data : null;
}

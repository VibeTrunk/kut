import { isUuid } from "@/lib/uuid";

/**
 * One member's kudos ballot for one session, as the report form holds it.
 *
 * A category is in exactly one of three states, and the third is the point:
 * `UNDECIDED` is not a Skip. The form used to open every category on "Skip",
 * so a member who never reached the kudos fieldset still cast three explicit
 * Skips (ADR-068 / KB-015). Keeping "not answered yet" distinct lets a draft
 * record it faithfully and lets a submission refuse it.
 */
export const UNDECIDED = "";
export const SKIP = "skip";
export type BallotChoice = typeof UNDECIDED | typeof SKIP | string;
export type Ballot = Record<string, BallotChoice>;

/**
 * The ballot to open the form on: a saved nomination wins, then a recorded
 * explicit Skip, and anything the member has not answered stays undecided.
 */
export function seedBallot(
  categoryIds: string[],
  savedNominations: Record<string, string>,
  explicitSkips: string[],
): Ballot {
  const skipped = new Set(explicitSkips);
  return Object.fromEntries(
    categoryIds.map((categoryId) => [
      categoryId,
      savedNominations[categoryId] ?? (skipped.has(categoryId) ? SKIP : UNDECIDED),
    ]),
  );
}

/** Categories the member has not answered yet. Empty means the ballot is complete. */
export function undecidedCategories(categoryIds: string[], ballot: Ballot): string[] {
  return categoryIds.filter((categoryId) => (ballot[categoryId] ?? UNDECIDED) === UNDECIDED);
}

/**
 * Player ids nominated in more than one category. The database enforces this
 * (`unique(session_id, nominator_player_id, recipient_player_id)`), so catching
 * it here turns a whole rejected save into an inline hint.
 */
export function duplicateNominees(categoryIds: string[], ballot: Ballot): string[] {
  const seen = new Map<string, number>();
  for (const categoryId of categoryIds) {
    const choice = ballot[categoryId] ?? UNDECIDED;
    if (choice === UNDECIDED || choice === SKIP) continue;
    seen.set(choice, (seen.get(choice) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([playerId]) => playerId);
}

export type BallotPayload =
  { ok: true; nominations: Record<string, string | null> } | { ok: false; error: string };

/**
 * The `p_nominations` argument for `kut.submit_session_report`.
 *
 * An explicit Skip is a JSON null; an undecided category is left out entirely,
 * which the RPC accepts on a draft and rejects on a submission. Both rules the
 * RPC enforces are checked here too, so a member gets a specific message
 * instead of the generic "could not save" the raised exception collapses into.
 */
export function ballotPayload(
  categoryIds: string[],
  ballot: Ballot,
  intent: "draft" | "submit",
): BallotPayload {
  const nominations: Record<string, string | null> = {};
  for (const categoryId of categoryIds) {
    if (!isUuid(categoryId)) return { ok: false, error: "The report categories changed." };
    const choice = ballot[categoryId] ?? UNDECIDED;
    if (choice === UNDECIDED) continue;
    if (choice === SKIP) {
      nominations[categoryId] = null;
      continue;
    }
    // A value that is neither Skip nor a player id is a stale or tampered form,
    // and must not be quietly recorded as the Skip the member did not choose.
    if (!isUuid(choice)) return { ok: false, error: "That nomination is no longer valid." };
    nominations[categoryId] = choice;
  }
  if (duplicateNominees(categoryIds, ballot).length > 0)
    return { ok: false, error: "Choose a different teammate in each category." };
  if (intent === "submit" && undecidedCategories(categoryIds, ballot).length > 0)
    return { ok: false, error: "Choose a teammate or Skip in every kudos category." };
  return { ok: true, nominations };
}

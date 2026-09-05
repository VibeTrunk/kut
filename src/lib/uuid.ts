const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Shape-check for a Postgres `uuid` column before it reaches a query. A
 * malformed id (e.g. a stray URL segment) fails the cast with a query error
 * rather than the intended "not found", so route params keyed by uuid must
 * check this before querying (KB-007).
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

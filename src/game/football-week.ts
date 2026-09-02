/** ISO Monday for a date-only ISO value, using UTC throughout. */
export function weekStart(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Expected YYYY-MM-DD, received ${isoDate}`);

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

/** Inclusive Sunday for an ISO Monday, as YYYY-MM-DD. */
export function weekEnd(weekStartIso: string): string {
  if (weekStart(weekStartIso) !== weekStartIso) {
    throw new Error(`Expected an ISO Monday, received ${weekStartIso}`);
  }
  const [year, month, day] = weekStartIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 6));
  return date.toISOString().slice(0, 10);
}

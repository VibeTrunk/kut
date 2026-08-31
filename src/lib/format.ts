const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Date-only display for timestamps and date strings shown to members
 * (Messages, the Home club-activity feed). No time component — the club
 * agreed the exact minute of a sale or pack open is noise.
 */
export function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

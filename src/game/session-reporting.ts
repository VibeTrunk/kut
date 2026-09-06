const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sessionUsesMemberReports(sessionDate: string, v2StartsWeek: string | null | undefined): boolean {
  if (!ISO_DATE.test(sessionDate) || !v2StartsWeek || !ISO_DATE.test(v2StartsWeek)) return false;
  return sessionDate >= v2StartsWeek;
}

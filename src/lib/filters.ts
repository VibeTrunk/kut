/**
 * URL maths for the shared filter bar (`src/components/filter-bar.tsx`).
 *
 * Pure — no React, no `next/*` — so the rules that decide what ends up in a
 * URL are unit-testable, the same reasoning as `src/lib/nav/routes.ts` and
 * `src/components/pack-reveal-state.ts`.
 */

export type FilterValues = Record<string, string | undefined>;

type BuildArgs = {
  basePath: string;
  /** Current values, from the page's searchParams. */
  values: FilterValues;
  /** Params that survive every change, e.g. `view=manage`. */
  preserve?: FilterValues;
  /** The change being made. An empty string clears the param. */
  patch: FilterValues;
  /** Values that are the default and so stay out of the URL, e.g. the sort. */
  defaults: FilterValues;
};

/**
 * The href for a filter change: current values, plus the patch, minus anything
 * empty or at its default.
 *
 * Dropping defaults keeps the canonical URL clean — `/market` rather than
 * `/market?sort=newest` — which matters because these URLs get shared between
 * members and bookmarked.
 */
export function buildFilterHref({ basePath, values, preserve, patch, defaults }: BuildArgs): string {
  const merged: FilterValues = { ...preserve, ...values, ...patch };
  const params = new URLSearchParams();

  for (const [name, raw] of Object.entries(merged)) {
    const value = raw?.trim();
    if (!value) continue;
    if (defaults[name] !== undefined && defaults[name] === value) continue;
    params.set(name, value);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * How many filters are currently narrowing the view, for the mobile Filters
 * pill. Sort is excluded by the caller: it always has a value and never
 * narrows anything, so counting it would mean the pill never reads zero.
 */
export function countActiveFilters(values: FilterValues, ignore: readonly string[] = []): number {
  return Object.entries(values).filter(([name, value]) => !ignore.includes(name) && !!value?.trim()).length;
}

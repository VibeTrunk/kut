"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconSearch } from "@/components/icons";
import { buildFilterHref, countActiveFilters, type FilterValues } from "@/lib/filters";

/**
 * The one filter bar, shared by the Market, the player directory and the
 * Collection's Manage grid.
 *
 * Those three show the same cards filtered by the same fields, and used to do
 * it three different ways: two `<form>`s of selects behind an explicit Filter
 * submit, and one row of instant-navigation chips with a search box that had no
 * button. Search, tier and sort mean the same thing on all three, so they now
 * look and behave the same everywhere: chips for a short enumerated set, a
 * select for a long one, search on the left, sort on the right, and everything
 * applies on click.
 *
 * Below `sm` the row collapses to a single Filters pill plus a chip per active
 * filter, with the full set in a sheet. That sheet is also the one honest home
 * for an Apply button: the Market's price bounds are the only control here that
 * genuinely wants one, because a half-typed number is not a filter.
 */

export type FilterOption = { value: string; label: string };

export type FilterBarProps = {
  /** Route these filters live on, e.g. "/market". */
  basePath: string;
  /** Current values, straight from the page's searchParams. */
  values: FilterValues;
  searchPlaceholder: string;
  searchName?: string;
  sorts: FilterOption[];
  /** Omitted from the URL when selected, keeping the default clean. */
  defaultSort: string;
  sortName?: string;
  /** Rendered as chips. Short enumerated sets only — tiers, today. */
  chips?: { name: string; allLabel: string; options: FilterOption[] };
  /** Rendered as selects. Long enumerated sets — archetypes, today. */
  selects?: { name: string; anyLabel: string; options: FilterOption[] }[];
  /** A numeric pair, e.g. min/max price. Gets the sheet's Apply button. */
  range?: { minName: string; maxName: string; minLabel: string; maxLabel: string };
  /** Params that must survive every filter change, e.g. `view=manage`. */
  preserve?: FilterValues;
  /** Result line rendered under the bar, e.g. "12 of 48 shown". */
  summary?: string;
};

const fieldClass =
  "min-h-11 rounded-xl border border-line bg-board-deep/60 px-3.5 text-sm font-semibold text-ink placeholder:text-ink-faint focus:border-brass/60 focus:outline-none";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";
const chipBase = "min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-extrabold capitalize transition-colors";
const chipOn = "border-brass/50 bg-brass/12 text-brass";
const chipOff = "border-line bg-board-deep/50 text-ink-dim hover:text-ink";

export function FilterBar({
  basePath,
  values,
  searchPlaceholder,
  searchName = "q",
  sorts,
  defaultSort,
  sortName = "sort",
  chips,
  selects,
  range,
  preserve,
  summary,
}: FilterBarProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(values[range?.minName ?? ""] ?? "");
  const [draftMax, setDraftMax] = useState(values[range?.maxName ?? ""] ?? "");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const href = (patch: FilterValues) =>
    buildFilterHref({ basePath, values, preserve, patch, defaults: { [sortName]: defaultSort } });

  const go = (patch: FilterValues) => router.push(href(patch));

  const activeCount = countActiveFilters(values, [sortName]);

  useEffect(() => {
    if (!sheetOpen) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    sheetRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSheetOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sheetOpen]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = new FormData(event.currentTarget).get(searchName);
    setSheetOpen(false);
    go({ [searchName]: typeof term === "string" ? term.trim() : "" });
  }

  function applyRange() {
    if (!range) return;
    setSheetOpen(false);
    go({ [range.minName]: draftMin.trim(), [range.maxName]: draftMax.trim() });
  }

  const searchField = (extraClass = "") => (
    <form action={basePath} className={`flex min-h-11 items-center gap-2 rounded-xl border border-line bg-board-deep/60 px-3.5 ${extraClass}`} onSubmit={submitSearch}>
      <IconSearch aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
      <input
        aria-label={searchPlaceholder}
        className="w-full min-w-0 bg-transparent text-sm font-semibold text-ink placeholder:text-ink-faint focus:outline-none"
        defaultValue={values[searchName] ?? ""}
        key={values[searchName] ?? ""}
        name={searchName}
        placeholder={searchPlaceholder}
      />
    </form>
  );

  const chipRow = chips && (
    <div className="flex flex-wrap items-center gap-2">
      <Link className={`${chipBase} ${values[chips.name] ? chipOff : chipOn} ${focusRing}`} href={href({ [chips.name]: "" })}>
        {chips.allLabel}
      </Link>
      {chips.options.map((option) => (
        <Link
          className={`${chipBase} ${values[chips.name] === option.value ? chipOn : chipOff} ${focusRing}`}
          href={href({ [chips.name]: option.value })}
          key={option.value}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );

  const selectFields = (selects ?? []).map((select) => (
    <select
      aria-label={select.anyLabel}
      className={`${fieldClass} ${focusRing}`}
      key={select.name}
      onChange={(event) => go({ [select.name]: event.target.value })}
      value={values[select.name] ?? ""}
    >
      <option value="">{select.anyLabel}</option>
      {select.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ));

  const sortField = (
    <select
      aria-label="Sort"
      className={`${fieldClass} ${focusRing}`}
      onChange={(event) => go({ [sortName]: event.target.value })}
      value={values[sortName] ?? defaultSort}
    >
      {sorts.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-3">
      {/* Desktop: one row, everything visible, applies on click. */}
      <div className="hidden flex-wrap items-center gap-3 border-b border-line/40 pb-6 sm:flex">
        {searchField("w-56")}
        {chipRow}
        {selectFields}
        {range && (
          <div className="flex items-center gap-2">
            <input
              aria-label={range.minLabel}
              className={`${fieldClass} w-24`}
              defaultValue={values[range.minName] ?? ""}
              inputMode="numeric"
              key={`min-${values[range.minName] ?? ""}`}
              onBlur={(event) => go({ [range.minName]: event.target.value.trim() })}
              placeholder={range.minLabel}
            />
            <input
              aria-label={range.maxLabel}
              className={`${fieldClass} w-24`}
              defaultValue={values[range.maxName] ?? ""}
              inputMode="numeric"
              key={`max-${values[range.maxName] ?? ""}`}
              onBlur={(event) => go({ [range.maxName]: event.target.value.trim() })}
              placeholder={range.maxLabel}
            />
          </div>
        )}
        <span className="grow" />
        {sortField}
      </div>

      {/* Mobile: a Filters pill, a chip per active filter, and sort. */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          aria-expanded={sheetOpen}
          className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-extrabold ${focusRing} ${
            activeCount > 0 ? `${chipOn}` : chipOff
          }`}
          onClick={() => setSheetOpen(true)}
          ref={triggerRef}
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full bg-brass px-1 text-[0.65rem] font-black leading-none tabular-nums text-ink-on-accent">
              {activeCount}
            </span>
          )}
        </button>
        <div className="min-w-0 grow overflow-x-auto">
          <div className="flex items-center gap-2">
            {Object.entries(values)
              .filter(([name, value]) => !!value && name !== sortName)
              .map(([name, value]) => (
                <Link
                  aria-label={`Remove filter ${value}`}
                  className={`${chipBase} ${chipOn} ${focusRing} flex shrink-0 items-center gap-1.5`}
                  href={href({ [name]: "" })}
                  key={name}
                >
                  {value}
                  <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </Link>
              ))}
          </div>
        </div>
        <span className="shrink-0">{sortField}</span>
      </div>

      {summary && <p className="text-xs font-bold text-ink-faint">{summary}</p>}

      {sheetOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 h-full w-full bg-board-deep/75 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
            type="button"
          />
          <div
            aria-label="Filters"
            className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-5 overflow-y-auto rounded-t-3xl border-t border-line bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
            ref={sheetRef}
            role="dialog"
            tabIndex={-1}
          >
            <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-line" />
            {searchField("")}
            {chips && (
              <div className="space-y-2">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">{chips.allLabel}</p>
                {chipRow}
              </div>
            )}
            {(selects ?? []).length > 0 && <div className="grid gap-2">{selectFields}</div>}
            {range && (
              <div className="space-y-2">
                <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Price</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label={range.minLabel}
                    className={fieldClass}
                    inputMode="numeric"
                    onChange={(event) => setDraftMin(event.target.value)}
                    placeholder={range.minLabel}
                    value={draftMin}
                  />
                  <input
                    aria-label={range.maxLabel}
                    className={fieldClass}
                    inputMode="numeric"
                    onChange={(event) => setDraftMax(event.target.value)}
                    placeholder={range.maxLabel}
                    value={draftMax}
                  />
                </div>
                {/* The only Apply in the app, and the only control that wants one:
                    a half-typed price is not a filter. */}
                <button
                  className={`min-h-11 w-full rounded-xl bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-5 text-sm font-black text-ink-on-accent ${focusRing}`}
                  onClick={applyRange}
                  type="button"
                >
                  Apply price
                </button>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Link
                className={`grid min-h-11 flex-1 place-items-center rounded-xl border border-line text-sm font-bold text-ink-dim ${focusRing}`}
                href={buildFilterHref({ basePath, values: {}, preserve, patch: {}, defaults: {} })}
                onClick={() => setSheetOpen(false)}
              >
                Clear all
              </Link>
              <button
                className={`grid min-h-11 flex-1 place-items-center rounded-xl border border-brass/60 text-sm font-black text-brass ${focusRing}`}
                onClick={() => setSheetOpen(false)}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

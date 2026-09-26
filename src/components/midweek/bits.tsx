import type { ReactNode } from "react";
import { IconInfo } from "@/components/icons";
import { ROUND_ONE_CLOCK, type Segment } from "@/lib/midweek/entry";

/**
 * The small pieces of the Midweek pages: the save status, the keeper check,
 * notices, the privacy line and the trialist frame. Presentational only, so
 * both server pages and the picker can render them.
 */

/** `MidweekSaveStatus`. The dot's shape differs per state, so colour is never the only signal. */
export function MidweekSaveStatus({
  kind,
  text,
}: {
  kind: "none" | "dirty" | "saved";
  text: string;
}) {
  const tone = {
    none: "text-ink-faint",
    dirty: "text-warning",
    saved: "text-moss",
  }[kind];
  const dot = {
    none: "border-2 border-dashed border-ink-faint",
    dirty: "border-2 border-warning",
    saved: "bg-moss",
  }[kind];
  return (
    <p
      className={`inline-flex items-center gap-2 text-[13px] font-extrabold ${tone}`}
      role="status"
    >
      <i aria-hidden="true" className={`h-[9px] w-[9px] flex-none rounded-full ${dot}`} />
      {text}
    </p>
  );
}

export function Segments({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.strong ? (
          <b className="text-ink" key={index}>
            {segment.text}
          </b>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/** `MidweekKeeperCheck`. */
export function MidweekKeeperCheck({
  tone,
  segments,
}: {
  tone: "ok" | "warn";
  segments: readonly Segment[];
}) {
  return (
    <p className="flex items-start gap-2.5 text-[13px] leading-normal text-ink-dim">
      <span
        aria-hidden="true"
        className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-md border text-[11px] font-black ${
          tone === "ok"
            ? "border-moss-line bg-moss-bg text-moss"
            : "border-warning-line bg-warning-bg text-warning"
        }`}
      >
        {tone === "ok" ? "GK" : "!"}
      </span>
      <span>
        <Segments segments={segments} />
      </span>
    </p>
  );
}

/** A boxed notice with a round mark; `warn` for things that changed under the member. */
export function MidweekNotice({
  tone,
  children,
  live = false,
}: {
  tone: "info" | "warn";
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-dim ${
        tone === "warn" ? "border-warning-line bg-warning-bg/55" : "border-line bg-panel/60"
      }`}
      role={live ? "status" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-xs font-black ${
          tone === "warn" ? "bg-warning text-[#1d1206]" : "bg-steel text-[#0d171c]"
        }`}
      >
        {tone === "warn" ? "!" : "i"}
      </span>
      <div className="min-w-0 [&_b]:text-ink">{children}</div>
    </div>
  );
}

/** The privacy line (ADR-091): what other members will see, said up front. */
export function MidweekPrivacyLine() {
  return (
    <p className="flex items-start gap-2.5 text-[13px] leading-normal text-ink-dim">
      <IconInfo aria-hidden="true" className="mt-px h-4 w-4 flex-none text-steel" />
      <span>
        From {ROUND_ONE_CLOCK} on Wednesday, members see the five cards you enter. Never the rest of
        your collection.
      </span>
    </p>
  );
}

/**
 * `MidweekTrialistCard`: a card-sized dashed frame for the desktop team sheet.
 * Spans throughout, because the picker puts it inside a button.
 */
export function MidweekTrialistCard({
  slot,
  state,
  trialistOvr,
}: {
  slot: number;
  state: "trialist" | "choosing";
  trialistOvr: number;
}) {
  if (state === "choosing") {
    return (
      <span className="grid aspect-[5/7] w-full place-items-center content-center gap-1.5 rounded-[0.9rem] border-2 border-dashed border-brass-line bg-brass-bg/30 p-3 text-center text-brass">
        <b className="text-[44px] leading-none font-normal">+</b>
        <span className="text-xs font-extrabold tracking-[0.12em] uppercase">Choosing</span>
        <span className="max-w-48 text-xs leading-snug">Pick a card below for slot {slot}.</span>
      </span>
    );
  }
  return (
    <span className="grid aspect-[5/7] w-full place-items-center content-center gap-1.5 rounded-[0.9rem] border-2 border-dashed border-line bg-[repeating-linear-gradient(135deg,rgb(74_64_48/22%)_0_8px,transparent_8px_16px)] p-3 text-center text-ink-faint">
      <b className="text-[34px] leading-none font-black text-ink-dim">{trialistOvr}</b>
      <span className="text-xs font-extrabold tracking-[0.12em] uppercase">Trialist</span>
      <span className="max-w-48 text-xs leading-snug">
        Plays here if you leave it empty. Handicapped, so a real card is always better.
      </span>
    </span>
  );
}

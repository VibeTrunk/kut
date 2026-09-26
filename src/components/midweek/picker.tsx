"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";
import {
  formatClock,
  formatDayDate,
  formatSavedAt,
  keeperCheck,
  prefillNotice,
  saveStatus,
} from "@/lib/midweek/entry";
import { saveMidweekSquad, type MidweekActionState } from "@/app/(app)/club/midweek/actions";
import {
  MidweekKeeperCheck,
  MidweekNotice,
  MidweekSaveStatus,
  MidweekTrialistCard,
  Segments,
} from "./bits";
import { MidweekMiniCard } from "./mini-card";

/** One pick tile: a Player, and the strongest copy a save sends for them. */
export type PickCard = {
  playerId: string;
  cardId: string;
  displayName: string;
  archetype: string;
  archetypeLabel: string;
  tierLabel: string;
  copies: number;
  card: LiveCardPlayer;
};

export type LastWeekPrefill = {
  slots: (string | null)[];
  lostNames: string[];
  lostSlots: number[];
};

type MidweekPickerProps = {
  cards: PickCard[];
  /** Player ids per slot, from the saved squad. */
  initialSlots: (string | null)[];
  savedCardIds: string[];
  savedAt: string | null;
  lastWeek: LastWeekPrefill | null;
  lockAt: string;
  trialistOvr: number;
  /** Saved cards the member no longer owns, already worded. */
  lostSavedNotice: string | null;
  /** The Picker-Starter lead, when fewer than five Players are owned. */
  starterLead: string | null;
};

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-black whitespace-nowrap";
const PRIMARY = `${BUTTON_BASE} bg-gradient-to-b from-[#eebd63] to-[#d29a34] text-ink-on-accent shadow-lg shadow-brass/25 disabled:opacity-45 disabled:shadow-none`;
const SECONDARY = `${BUTTON_BASE} border border-line bg-panel/70 text-ink disabled:opacity-45`;
const GHOST =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] px-3 text-sm font-extrabold text-brass hover:underline";
const ICON_BUTTON =
  "grid h-11 w-11 flex-none place-items-center rounded-[10px] text-ink-faint hover:text-brick";

function InjuredChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6b5238] bg-[#2e2217] px-2 py-0.5 text-[10.5px] leading-normal font-extrabold tracking-[0.08em] whitespace-nowrap text-[#e8c49c] uppercase before:h-1.5 before:w-3 before:flex-none before:-rotate-[20deg] before:rounded-[3px] before:bg-[linear-gradient(90deg,#e0b58a_0_35%,#f3dcc0_35%_65%,#e0b58a_65%)] before:content-['']">
      Injured
    </span>
  );
}

export function MidweekPicker({
  cards,
  initialSlots,
  savedCardIds,
  savedAt,
  lastWeek,
  lockAt,
  trialistOvr,
  lostSavedNotice,
  starterLead,
}: MidweekPickerProps) {
  const byPlayer = useMemo(() => new Map(cards.map((card) => [card.playerId, card])), [cards]);
  const [slots, setSlots] = useState<(string | null)[]>(initialSlots);
  const firstEmpty = (list: (string | null)[]) => {
    const index = list.indexOf(null);
    return index === -1 ? null : index;
  };
  // Nothing saved: the page opens on slot 1 "Choosing…", as Picker-Empty.
  const [activeSlot, setActiveSlot] = useState<number | null>(() =>
    savedCardIds.length === 0 && cards.length > 0 ? firstEmpty(initialSlots) : null,
  );
  const [prefillText, setPrefillText] = useState<ReturnType<typeof prefillNotice> | null>(null);
  const [filter, setFilter] = useState<"all" | "keepers">("all");
  const [state, formAction, pending] = useActionState<MidweekActionState, FormData>(
    saveMidweekSquad,
    null,
  );

  const picked = slots.map((playerId) => (playerId ? (byPlayer.get(playerId) ?? null) : null));
  const sendCardIds = picked.flatMap((card) => (card ? [card.cardId] : []));
  const status = saveStatus(savedCardIds, sendCardIds);
  const statusText =
    status === "none"
      ? "Not picked yet"
      : status === "dirty"
        ? "Unsaved changes"
        : savedAt
          ? `Saved ${formatSavedAt(savedAt)}`
          : "Saved";
  const keeper = keeperCheck(
    picked.flatMap((card) =>
      card ? [{ archetype: card.archetype, displayName: card.displayName }] : [],
    ),
  );
  const inSquad = new Set(slots.filter((id): id is string => id !== null));
  const full = firstEmpty(slots) === null;
  const keepers = cards.filter((card) => card.archetype === "goalkeeper");
  const shown = filter === "keepers" ? keepers : cards;
  const lockLabel = `${formatDayDate(lockAt)}, ${formatClock(lockAt)}`;

  function place(playerId: string) {
    const target = activeSlot ?? firstEmpty(slots);
    if (target === null) return;
    const next = slots.map((id, index) => (index === target ? playerId : id));
    setSlots(next);
    const after = next.findIndex((id, index) => id === null && index > target);
    setActiveSlot(after === -1 ? firstEmpty(next) : after);
  }

  function remove(index: number) {
    setSlots(slots.map((id, i) => (i === index ? null : id)));
  }

  function loadLastWeek() {
    if (!lastWeek) return;
    setSlots(lastWeek.slots);
    setActiveSlot(firstEmpty(lastWeek.slots));
    setPrefillText(prefillNotice(lastWeek.lostNames, lastWeek.lostSlots));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const notice = prefillText ? (
    <MidweekNotice live tone="warn">
      <Segments segments={prefillText} />
    </MidweekNotice>
  ) : lostSavedNotice ? (
    <MidweekNotice tone="warn">{lostSavedNotice}</MidweekNotice>
  ) : starterLead ? (
    <MidweekNotice tone="info">
      <b>{starterLead}</b> Trialists are handicapped; every Player you add from a pack beats one.{" "}
      <Link className="font-bold text-brass hover:underline" href="/club/packs">
        Open a pack &rarr;
      </Link>
    </MidweekNotice>
  ) : status === "none" ? (
    <MidweekNotice tone="info">
      <b>No pick, no problem, just a worse one.</b> If you haven&rsquo;t saved a five by{" "}
      {formatClock(lockAt)} on Wednesday, an <b>auto squad</b> plays for you: up to five random
      Players from your collection, all heavily handicapped. Picking takes a minute.
    </MidweekNotice>
  ) : null;

  return (
    <div className="grid gap-7">
      {notice}

      <div className="flex flex-col gap-7">
        <section aria-labelledby="mw-squad-h" className="order-1 grid gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="display text-3xl" id="mw-squad-h">
              Your five
            </h2>
            <MidweekSaveStatus kind={status} text={statusText} />
          </div>

          {/* Below lg: one row per slot. */}
          <ol className="grid gap-2 lg:hidden">
            {slots.map((playerId, index) => {
              const card = picked[index];
              const n = index + 1;
              const active = activeSlot === index;
              const rowBase =
                "relative grid min-h-[76px] grid-cols-[18px_46px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px]";
              if (!card || !playerId) {
                return (
                  <li
                    className={`${rowBase} ${
                      active
                        ? "border-2 border-brass bg-brass-bg/45 py-[7px] pr-[7px] pl-[9px]"
                        : "border border-dashed border-line/70 bg-panel/35 py-2 pr-2 pl-2.5"
                    }`}
                    key={n}
                  >
                    <span
                      className={`text-center text-xs font-black tabular-nums ${active ? "text-brass" : "text-ink-faint"}`}
                    >
                      {n}
                    </span>
                    {active ? (
                      <MidweekMiniCard variant="empty" />
                    ) : (
                      <MidweekMiniCard ovr={trialistOvr} variant="trialist" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[15px] leading-tight font-extrabold text-ink-dim">
                        {active ? "Choosing…" : "Trialist"}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-ink-dim">
                        {active
                          ? "Tap a card below to put it here."
                          : `Plays here if you leave it empty: a Common All-rounder, OVR ${trialistOvr}, handicapped.`}
                      </p>
                    </div>
                    <div className="flex">
                      {active ? (
                        <button className={GHOST} onClick={() => setActiveSlot(null)} type="button">
                          Cancel
                        </button>
                      ) : (
                        <button
                          aria-label={`Add a card to slot ${n}`}
                          className={GHOST}
                          onClick={() => setActiveSlot(index)}
                          type="button"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </li>
                );
              }
              return (
                <li
                  className={`${rowBase} ${
                    active
                      ? "border-2 border-brass bg-brass-bg/45 py-[7px] pr-[7px] pl-[9px]"
                      : "border border-line/70 bg-panel/80 py-2 pr-2 pl-2.5"
                  }`}
                  key={n}
                >
                  <span
                    className={`text-center text-xs font-black tabular-nums ${active ? "text-brass" : "text-ink-faint"}`}
                  >
                    {n}
                  </span>
                  <MidweekMiniCard
                    injured={card.card.injured}
                    ovr={card.card.liveOvr}
                    rarityTier={card.card.rarityTier}
                  />
                  <button
                    aria-label={
                      active
                        ? `Choosing a card to replace ${card.displayName} in slot ${n}`
                        : `Swap ${card.displayName} in slot ${n}`
                    }
                    aria-pressed={active}
                    className="min-w-0 text-left"
                    onClick={() => setActiveSlot(active ? null : index)}
                    type="button"
                  >
                    <span className="block text-[15px] leading-tight font-black [overflow-wrap:anywhere]">
                      {card.displayName}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-dim">
                      {active
                        ? "Tap a card below to swap it in."
                        : `${card.archetypeLabel} · ${card.tierLabel} · OVR ${card.card.liveOvr}${
                            card.card.injured ? " · plays at reduced fitness" : ""
                          }`}
                    </span>
                    {card.card.injured && !active && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <InjuredChip />
                      </span>
                    )}
                  </button>
                  <div className="flex">
                    <button
                      aria-label={`Remove ${card.displayName} from slot ${n}`}
                      className={ICON_BUTTON}
                      onClick={() => remove(index)}
                      type="button"
                    >
                      <span aria-hidden="true">&#10005;</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* From lg: the team sheet, five cards side by side. Hidden from
              assistive tech below lg by `hidden`, and the rows above are
              hidden from lg, so each size has exactly one list. */}
          <ol aria-label="Your five" className="hidden grid-cols-5 gap-5 lg:grid">
            {slots.map((playerId, index) => {
              const card = picked[index];
              const n = index + 1;
              const active = activeSlot === index;
              return (
                <li className="grid content-start gap-2.5" key={n}>
                  <p className="flex min-h-8 items-center justify-between gap-1 text-xs font-extrabold text-ink-faint">
                    <span>Slot {n}</span>
                    {card && (
                      <span className="flex items-center">
                        <button
                          aria-pressed={active}
                          className="min-h-8 rounded-lg px-2 text-brass hover:underline"
                          onClick={() => setActiveSlot(active ? null : index)}
                          type="button"
                        >
                          {active ? "Cancel" : "Swap"}
                          <span className="sr-only"> {card.displayName}</span>
                        </button>
                        <button
                          aria-label={`Remove ${card.displayName} from slot ${n}`}
                          className="grid h-8 w-8 place-items-center rounded-lg hover:text-brick"
                          onClick={() => remove(index)}
                          type="button"
                        >
                          <span aria-hidden="true">&#10005;</span>
                        </button>
                      </span>
                    )}
                  </p>
                  {card && playerId ? (
                    <div
                      className={`rounded-[0.9rem] ${active ? "outline-3 outline-offset-4 outline-brass" : ""}`}
                    >
                      <LiveCard player={card.card} />
                    </div>
                  ) : (
                    <button
                      aria-label={
                        active ? `Stop choosing for slot ${n}` : `Add a card to slot ${n}`
                      }
                      aria-pressed={active}
                      className={`rounded-[0.9rem] ${active ? "outline-3 outline-offset-4 outline-brass" : ""}`}
                      onClick={() => setActiveSlot(active ? null : index)}
                      type="button"
                    >
                      <MidweekTrialistCard
                        slot={n}
                        state={active ? "choosing" : "trialist"}
                        trialistOvr={trialistOvr}
                      />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>

          {inSquad.size > 0 && <MidweekKeeperCheck segments={keeper.segments} tone={keeper.tone} />}
        </section>

        {/* The save bar. Below sm it is last in the flow and sticky, so it
            stays pinned above the tab bar while the member scrolls the grid;
            from sm it sits inline under the squad. */}
        <form
          className="sticky bottom-[calc(4.5rem_+_env(safe-area-inset-bottom,0px))] z-20 order-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-line/70 bg-board-deep/92 p-2 shadow-[0_-10px_24px_-12px_rgb(0_0_0/70%)] sm:static sm:order-2"
          onSubmit={submit}
        >
          {sendCardIds.map((id) => (
            <input key={id} name="card_id" type="hidden" value={id} />
          ))}
          {lastWeek ? (
            <button
              className={`${SECONDARY} sm:justify-self-start`}
              onClick={loadLastWeek}
              type="button"
            >
              Load last week&rsquo;s five
            </button>
          ) : (
            <span />
          )}
          {status === "saved" ? (
            <button className={SECONDARY} disabled type="button">
              &#10003; Saved
            </button>
          ) : (
            <button
              className={PRIMARY}
              disabled={sendCardIds.length === 0 || pending}
              type="submit"
            >
              {pending ? "Saving…" : "Save your five"}
            </button>
          )}
          <p className="col-span-2 px-1.5 pt-0.5 text-[11.5px] text-ink-faint" role="status">
            {state?.ok === false ? (
              <span className="font-bold text-brick">{state.error}</span>
            ) : state?.ok && status === "saved" ? (
              <span className="font-bold text-moss">{state.message}</span>
            ) : (
              `Change it as often as you like until ${lockLabel}.`
            )}
          </p>
        </form>

        <section aria-labelledby="mw-cards-h" className="order-2 grid gap-3 sm:order-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="display text-3xl" id="mw-cards-h">
              Your cards
            </h2>
            {keepers.length > 0 && keepers.length < cards.length && (
              <div
                aria-label="Show"
                className="inline-flex gap-0.5 rounded-xl border border-line p-[3px]"
                role="group"
              >
                {(
                  [
                    ["all", `All ${cards.length}`],
                    ["keepers", `Goalkeepers ${keepers.length}`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    aria-pressed={filter === key}
                    className={`grid min-h-[38px] place-items-center rounded-[9px] px-3 text-[13px] font-extrabold ${
                      filter === key ? "bg-brass/14 text-brass" : "text-ink-dim"
                    }`}
                    key={key}
                    onClick={() => setFilter(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-ink-faint">
            One slot per Player. Where you own two copies, the stronger one plays.
            {full &&
              activeSlot === null &&
              " Your five is full: remove a card, or tap one to swap it."}
          </p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-6 lg:grid-cols-5">
            {shown.map((card) => {
              const isIn = inSquad.has(card.playerId);
              const target = activeSlot ?? firstEmpty(slots);
              return (
                <li className="grid content-start gap-2" key={card.playerId}>
                  <div
                    className={`relative ${
                      isIn
                        ? "[&_.live-card]:outline-3 [&_.live-card]:outline-offset-3 [&_.live-card]:outline-moss"
                        : ""
                    }`}
                  >
                    <LiveCard player={card.card} />
                    {card.copies > 1 && (
                      <span className="absolute -top-1.5 -right-1 z-10 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] font-black text-ink-dim">
                        &times;{card.copies} copies
                      </span>
                    )}
                  </div>
                  {isIn ? (
                    <p className="flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-moss-line bg-moss-bg text-[13px] font-black text-moss">
                      &#10003; In your five
                      <span className="sr-only">: {card.displayName}</span>
                    </p>
                  ) : (
                    <button
                      aria-label={`${activeSlot !== null ? `Put in slot ${activeSlot + 1}` : "Add to your five"}: ${card.displayName}${card.card.injured ? ", injured" : ""}`}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-brass-line bg-brass-bg/60 text-[13px] font-black text-brass disabled:opacity-45"
                      disabled={target === null}
                      onClick={() => place(card.playerId)}
                      type="button"
                    >
                      {activeSlot !== null ? `Put in slot ${activeSlot + 1}` : "Add to your five"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

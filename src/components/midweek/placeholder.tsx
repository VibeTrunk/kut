/**
 * `MidweekPlaceholder` (HANDOFF "Placeholders, not decided"): a dashed frame
 * that holds the place of something the owner hasn't decided yet, so the page
 * already has its shape. Each one is replaced by its own ADR.
 */
export function MidweekPlaceholder({ name, note }: { name: string; note: string }) {
  return (
    <div
      className="grid gap-1 rounded-[14px] border-[1.5px] border-dashed border-brick p-3.5 text-sm text-ink-dim"
      role="note"
    >
      <b className="text-[11px] font-black tracking-[0.14em] text-brick uppercase">
        Placeholder &middot; not decided
      </b>
      <span>
        <strong className="text-ink">{name}.</strong> {note}
      </span>
    </div>
  );
}

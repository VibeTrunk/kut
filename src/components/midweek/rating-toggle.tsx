"use client";

import { useState, type ReactNode } from "react";

/**
 * The one button for a ratings block (DR3 HANDOFF §1): `Show each match` /
 * `Hide each match` opens the per-match chips under every card at once. The
 * chips are rendered on the server and shown through `data-open`, so this is
 * the only client code in the block.
 */
export function MidweekRatingToggle({
  defaultOpen,
  controls,
  link,
  children,
}: {
  defaultOpen: boolean;
  /** The id of the element holding the chips. */
  controls: string;
  link: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="group grid gap-4" data-open={open ? "true" : "false"}>
      {children}
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
        <button
          aria-controls={controls}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line bg-panel/70 px-3.5 text-sm font-black whitespace-nowrap text-ink hover:border-brass"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "Hide each match" : "Show each match"}
        </button>
        {link}
      </div>
    </div>
  );
}

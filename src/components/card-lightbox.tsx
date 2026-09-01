"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconExpand } from "@/components/icons";
import { LiveCard, type LiveCardPlayer } from "@/components/live-card";

/**
 * A dedicated "view this card full screen" affordance (tester idea 01,
 * ADR-044). It renders a small expand button positioned over the card; the
 * card body's own tap target (a `next/link` to the detail page on the grids)
 * is left untouched.
 *
 * Portal-free: the overlay is `position: fixed` and no ancestor of a card
 * grid carries a transform/filter, so it covers the viewport as-is. No inline
 * `style` — production CSP strips the `style` attribute — so the fixed overlay
 * and its zoom-in animation live in `globals.css` (`.card-lightbox*`), with a
 * `prefers-reduced-motion` guard there.
 */
export function CardLightbox({ player }: { player: LiveCardPlayer }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    document.body.classList.add("overflow-hidden");
    closeRef.current?.focus();

    return () => {
      document.body.classList.remove("overflow-hidden");
      // Restore focus to the button that opened the dialog.
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label={`View ${player.displayName}'s card full screen`}
        className="card-zoom-trigger"
        onClick={(event) => {
          // The trigger sits inside a `next/link` card wrapper on the grids;
          // don't also follow the link.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <IconExpand className="h-4 w-4" />
      </button>

      {open && (
        <div
          aria-label={`${player.displayName}'s card`}
          aria-modal="true"
          className="card-lightbox"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
            // Close is the only focusable control; keep focus on it.
            if (event.key === "Tab") {
              event.preventDefault();
              closeRef.current?.focus();
            }
          }}
          role="dialog"
          tabIndex={-1}
        >
          <div className="card-lightbox__stage">
            <LiveCard player={player} size="detail" />
          </div>
          <button className="card-lightbox__close" onClick={close} ref={closeRef} type="button">
            Close
          </button>
        </div>
      )}
    </>
  );
}

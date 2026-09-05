"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * A bottom sheet for phone-width surfaces: the account menu and the filter bar.
 *
 * Extracted rather than hand-rolled twice. The filter sheet came first and the
 * account sheet would have been a near-copy — the same mistake that produced two
 * Album/Manage toggles and two Collection headers before ADR-053 merged them.
 *
 * Deliberately mobile-only. Desktop keeps its dropdowns: a sheet is the right
 * idiom for a thumb, an anchored panel is the right idiom for a pointer, and
 * that divergence is the point rather than an inconsistency to iron out.
 */
type BottomSheetProps = {
  /** Accessible name for the dialog. */
  label: string;
  open: boolean;
  onClose: () => void;
  /** Focused when the sheet closes, so keyboard users are not dropped at the top. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function BottomSheet({ label, open, onClose, returnFocusRef, children }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
      returnFocusRef?.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <button
        aria-label={`Close ${label.toLowerCase()}`}
        className="absolute inset-0 h-full w-full bg-board-deep/75 backdrop-blur-sm"
        onClick={() => {
          onClose();
          returnFocusRef?.current?.focus();
        }}
        type="button"
      />
      {/* The sheet clears the tab bar's safe-area inset the same way the page
          wrapper does (KB-010), so its last control is never under the bar. */}
      <div
        aria-label={label}
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-5 overflow-y-auto rounded-t-3xl border-t border-line bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl shadow-board/80"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}

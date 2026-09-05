"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

type Props = { previousHref?: string; nextHref?: string; children: ReactNode };

/** Distance a horizontal drag must cover before it counts as turning a leaf. */
const SWIPE_THRESHOLD_PX = 60;
/** Beyond this much vertical travel it is a scroll, not a page turn. */
const SCROLL_TOLERANCE_PX = 40;

/**
 * Turning a leaf: arrow keys on desktop, a horizontal swipe on a phone.
 *
 * Both are additions to the visible link pagination, never a replacement — the
 * "Page 3 ›" buttons and the page index stay the discoverable, accessible route,
 * and the swipe is what a phone user will try first on something drawn as a
 * bound album.
 *
 * Touch handlers are passive listeners via React's synthetic events, so a
 * vertical scroll is never blocked; a gesture is only claimed once it is clearly
 * horizontal.
 */
export function AlbumKeyboardNavigation({ previousHref, nextHref, children }: Props) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const origin = start.current;
    const touch = event.changedTouches[0];
    start.current = null;
    if (!origin || !touch) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dy) > SCROLL_TOLERANCE_PX) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    // Swiping left drags the page leftwards, revealing the next leaf.
    const href = dx < 0 ? nextHref : previousHref;
    if (href) router.push(href);
  }

  return (
    <div
      aria-label="Album pages"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" && previousHref) {
          event.preventDefault();
          router.push(previousHref);
        }
        if (event.key === "ArrowRight" && nextHref) {
          event.preventDefault();
          router.push(nextHref);
        }
      }}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

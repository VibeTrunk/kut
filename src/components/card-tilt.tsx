"use client";

import type { ReactNode } from "react";

const MAX_Y = 16;
const MAX_X = 13;

/**
 * Pointer parallax for Elite cards (ADR-043). Wraps a `LiveCard` and writes
 * `--card-tilt-x/y` straight onto the `.live-card` element, which the
 * stylesheet feeds into a `perspective()` transform; the OVR, nameplate and
 * pennant sit on their own `translateZ` planes, so the card reads as an
 * object rather than a picture.
 *
 * Custom properties are set through CSSOM rather than a React `style` prop on
 * purpose: production CSP is `style-src 'self' 'nonce-…'`, which strips the
 * inline `style` attribute a server-rendered style prop would emit. CSSOM
 * writes are not covered by `style-src`.
 *
 * The wrapper is `display: contents`, so it adds no box and cannot disturb the
 * grid it sits in; pointer events reach it by bubbling from the card.
 */
export function CardTilt({ children }: { children: ReactNode }) {
  function cardFrom(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>(".live-card") : null;
  }

  function reset(card: HTMLElement | null) {
    card?.style.removeProperty("--card-tilt-x");
    card?.style.removeProperty("--card-tilt-y");
  }

  return (
    <div
      className="contents"
      onPointerLeave={(event) => reset(cardFrom(event.target))}
      onPointerMove={(event) => {
        // A fine pointer only: on touch the card is being scrolled past, not
        // inspected, and reduced motion means the tilt should not happen at all.
        if (event.pointerType !== "mouse") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const card = cardFrom(event.target);
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--card-tilt-y", `${(x * MAX_Y).toFixed(2)}deg`);
        card.style.setProperty("--card-tilt-x", `${(-y * MAX_X).toFixed(2)}deg`);
      }}
    >
      {children}
    </div>
  );
}

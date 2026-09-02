"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type Props = { previousHref?: string; nextHref?: string; children: ReactNode };

/** Keyboard turn support, isolated from the server-rendered link pagination. */
export function AlbumKeyboardNavigation({ previousHref, nextHref, children }: Props) {
  const router = useRouter();
  return <div aria-label="Album pages" onKeyDown={(event) => {
    if (event.key === "ArrowLeft" && previousHref) { event.preventDefault(); router.push(previousHref); }
    if (event.key === "ArrowRight" && nextHref) { event.preventDefault(); router.push(nextHref); }
  }} tabIndex={0}>{children}</div>;
}

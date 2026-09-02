"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type LensMenuProps = { label: string; items: { href: string; label: string }[] };

export function LensMenu({ label, items }: LensMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <div className="relative" ref={root}><button aria-expanded={open} className="min-h-10 rounded-full border border-line px-4 py-2 text-xs font-bold text-ink-dim" onClick={() => setOpen((value) => !value)} type="button">{label}</button>{open && <div className="absolute z-20 mt-2 grid min-w-36 rounded-xl border border-line bg-board p-2 shadow-xl">{items.map((item) => <Link className="rounded-lg px-3 py-2 text-sm hover:bg-panel" href={item.href} key={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}</div>}</div>;
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostic detail in server/browser logs; users receive only a safe recovery message.
    console.error("KUT route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-lg rounded-3xl border border-brick-line/40 bg-panel p-6 shadow-2xl shadow-board/50">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-brick">KUT needs a moment</p>
        <h1 className="mt-3 text-3xl font-black">This page could not be loaded</h1>
        <p className="mt-3 text-ink-dim">No game action was completed by this error. Try again, or return to Live Ratings and continue from there.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="min-h-11 rounded-xl bg-brass px-4 font-black text-ink-on-accent" onClick={reset} type="button">Try again</button>
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-bold hover:border-brass" href="/">Live Ratings</Link>
        </div>
      </section>
    </main>
  );
}

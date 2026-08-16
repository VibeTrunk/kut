"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep diagnostic detail in server/browser logs; users receive only a safe recovery message.
    console.error("KUT route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-lg rounded-3xl border border-rose-400/40 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-rose-300">KUT needs a moment</p>
        <h1 className="mt-3 text-3xl font-black">This page could not be loaded</h1>
        <p className="mt-3 text-slate-300">No game action was completed by this error. Try again, or return to Live Ratings and continue from there.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="min-h-11 rounded-xl bg-amber-400 px-4 font-black text-slate-950" onClick={reset} type="button">Try again</button>
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-4 font-bold hover:border-amber-400" href="/">Live Ratings</Link>
        </div>
      </section>
    </main>
  );
}

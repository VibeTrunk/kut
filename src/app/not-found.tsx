import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-lg rounded-3xl border border-line bg-panel p-6">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-brass">KUT</p>
        <h1 className="mt-3 text-3xl font-black">Page not found</h1>
        <p className="mt-3 text-ink-dim">This link is unavailable, or the card or saved result no longer belongs to this account.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brass px-4 font-black text-ink-on-accent" href="/">Go to Live Ratings</Link>
      </section>
    </main>
  );
}

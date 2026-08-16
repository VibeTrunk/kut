type PageLoadingProps = { label?: string };

export function PageLoading({ label = "Loading KUT..." }: PageLoadingProps) {
  return (
    <main aria-busy="true" className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-400">KUT</p>
        <div className="animate-pulse space-y-4" role="status">
          <div className="h-11 max-w-sm rounded-xl bg-slate-800" />
          <div className="h-5 max-w-xl rounded bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-64 rounded-3xl bg-slate-900" />
            <div className="h-64 rounded-3xl bg-slate-900" />
            <div className="h-64 rounded-3xl bg-slate-900" />
          </div>
          <span className="sr-only">{label}</span>
        </div>
      </section>
    </main>
  );
}

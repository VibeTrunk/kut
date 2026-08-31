type PageLoadingProps = { label?: string };

export function PageLoading({ label = "Loading KUT..." }: PageLoadingProps) {
  return (
    <main aria-busy="true" className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-6">
        <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">KUT</p>
        <div className="animate-pulse space-y-4" role="status">
          <div className="h-11 max-w-sm rounded-xl bg-panel-2" />
          <div className="h-5 max-w-xl rounded bg-panel-2" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-64 rounded-3xl bg-panel" />
            <div className="h-64 rounded-3xl bg-panel" />
            <div className="h-64 rounded-3xl bg-panel" />
          </div>
          <span className="sr-only">{label}</span>
        </div>
      </section>
    </main>
  );
}

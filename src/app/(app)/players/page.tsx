import { IconDirectory } from "@/components/icons";
import { requireUser } from "@/lib/auth/user";

export default async function PlayerDirectoryPage() {
  await requireUser();

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">KUT roster</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Player directory</h1>
        </header>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center">
          <IconDirectory className="h-10 w-10 text-slate-500" />
          <h2 className="text-xl font-black">Coming soon</h2>
          <p className="max-w-md text-slate-400">A searchable roster of every TFH player is planned for Phase 1A. For now, browse published players from Home.</p>
        </div>
      </section>
    </main>
  );
}

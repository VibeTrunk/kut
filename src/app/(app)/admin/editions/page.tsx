import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

type EditionArchiveRow = { id: string; title: string; edition_type: string };

export default async function EditionsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("kut")
    .from("card_editions")
    .select("id,title,edition_type,issued_at")
    .eq("is_live", false)
    .order("issued_at", { ascending: false });

  if (error) throw new Error("Could not load the edition archive.");
  const editions = (data ?? []) as EditionArchiveRow[];

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-6xl space-y-8 py-4 sm:py-8">
        <header>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.28em] text-brass">Club administration</p>
          <h1 className="display mt-3 text-3xl sm:text-6xl">Special editions</h1>
        </header>

        {editions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-board-deep/35 px-6 py-12 text-center sm:px-10 sm:py-16">
            <div aria-hidden="true" className="mx-auto flex aspect-[5/7] w-28 items-center justify-center rounded-2xl border border-dashed border-steel/50 bg-panel text-4xl text-brass">▱</div>
            <h2 className="display mx-auto mt-7 max-w-sm text-3xl">No special editions have been issued.</h2>
            <p className="mx-auto mt-4 max-w-lg text-ink-dim">A football moment, kept on a card. When editions are introduced, their history will live here.</p>
            <p className="mx-auto mt-7 max-w-lg border-t border-line/60 pt-7 text-sm text-ink-dim">Packs currently contain Live cards only.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/50 border-y border-line/60">
            {editions.map((edition) => (
              <li className="flex min-h-16 items-center justify-between gap-4 py-4" key={edition.id}>
                <span className="font-black">{edition.title}</span>
                <span className="text-sm capitalize text-ink-dim">{edition.edition_type.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-ink-dim">Foundation only: there is no edition creation, issuance action, or Special card in this release.</p>
      </section>
    </main>
  );
}

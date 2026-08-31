import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

type ActivityKind = "sale" | "listing" | "pack" | "session";
type ActivityRow = {
  kind: ActivityKind;
  ts: string;
  actor_name: string | null;
  counterparty_name: string | null;
  card_name: string | null;
  amount: number | null;
  session_date: string | null;
  session_type: string | null;
};

const PAGE_SIZE = 200;

const KIND_LABEL: Record<ActivityKind, string> = {
  sale: "Sale",
  listing: "New listing",
  pack: "Pack opened",
  session: "Session published",
};

function formatTs(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function describe(row: ActivityRow): string {
  const coins = (n: number | null) => `${n ?? 0} KUT Coins`;
  switch (row.kind) {
    case "sale":
      return `${row.actor_name ?? "A member"} sold ${row.card_name ?? "a card"} to ${row.counterparty_name ?? "a member"} for ${coins(row.amount)}.`;
    case "listing":
      return `${row.actor_name ?? "A member"} listed ${row.card_name ?? "a card"} for ${coins(row.amount)}.`;
    case "pack":
      return `${row.actor_name ?? "A member"} opened a pack (${coins(row.amount)}).`;
    case "session":
      return `A new session was published${row.session_date ? ` — ${row.session_date} · ${row.session_type ?? "session"}` : ""}.`;
  }
}

type FeedPageProps = { searchParams: Promise<{ before?: string }> };

export default async function FeedPage({ searchParams }: FeedPageProps) {
  await requireUser();
  const { before } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .schema("kut")
    .from("activity_feed")
    .select("kind, ts, actor_name, counterparty_name, card_name, amount, session_date, session_type")
    .order("ts", { ascending: false })
    .limit(PAGE_SIZE);

  if (before && !Number.isNaN(Date.parse(before))) {
    query = query.lt("ts", before);
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not load the activity feed.");
  const rows = (data ?? []) as ActivityRow[];
  const olderCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].ts : null;

  return (
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Club activity</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Newsfeed</h1>
          <p className="mt-3 max-w-2xl text-ink-dim">
            Recent sales, new listings, pack openings, and published sessions across the whole club.
            {before ? " Showing older activity." : ""}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-panel/60 p-8 text-center text-ink-dim">
            {before ? "Nothing older to show." : "No club activity yet."}
          </p>
        ) : (
          <ol className="space-y-3">
            {rows.map((row, index) => (
              <li className="rounded-2xl border border-panel-2 bg-panel/50 p-5" key={`${row.kind}-${row.ts}-${index}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-brass">{KIND_LABEL[row.kind]}</p>
                  <time className="text-xs font-semibold text-ink-faint" dateTime={row.ts}>
                    {formatTs(row.ts)}
                  </time>
                </div>
                <p className="mt-2 text-ink-dim">{describe(row)}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="flex justify-between text-sm font-semibold">
          {before ? (
            <Link className="text-brass underline" href="/feed">
              &larr; Latest
            </Link>
          ) : (
            <span />
          )}
          {olderCursor && (
            <Link className="text-brass underline" href={`/feed?before=${encodeURIComponent(olderCursor)}`}>
              Older activity &rarr;
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

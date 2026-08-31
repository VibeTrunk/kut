import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .schema("kut")
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="board-ground min-h-screen p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8 py-4 sm:py-8">
        <header className="space-y-3">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Account</p>
          <h1 className="display text-5xl sm:text-6xl">Settings</h1>
        </header>

        <div className="rounded-2xl border border-line/60 bg-panel/60 p-6">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-ink-faint">Signed in as</p>
          <p className="mt-2 text-2xl font-black">{user.displayName}</p>
          {profile?.username && (
            <p className="mt-1.5 text-sm text-ink-faint">
              Username: <span className="font-bold text-ink-dim">{profile.username}</span>
            </p>
          )}
        </div>

        <Link
          className="group flex items-center justify-between gap-4 rounded-2xl border border-line/60 bg-panel/60 p-6 hover:border-brass/60"
          href="/settings/card"
        >
          <span>
            <span className="display block text-3xl group-hover:text-brass">My card</span>
            <span className="mt-2 block text-sm text-ink-faint">
              Upload your player photo and choose your archetype.
            </span>
          </span>
          <span aria-hidden="true" className="text-2xl text-brass">
            &rarr;
          </span>
        </Link>

        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-center text-sm text-ink-faint">
          Notification preferences are planned for a later polish pass.
        </p>

        <LogoutButton />
      </section>
    </main>
  );
}

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
    <main className="min-h-screen bg-board p-5 text-ink sm:p-10">
      <section className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">Account</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Settings</h1>
        </header>
        <div className="rounded-3xl border border-line bg-panel/60 p-6">
          <p className="text-xs font-black uppercase tracking-[0.13em] text-ink-faint">Signed in as</p>
          <p className="mt-1 text-xl font-black">{user.displayName}</p>
          {profile?.username && (
            <p className="mt-1 text-sm text-ink-faint">
              Username: <span className="font-semibold text-ink-dim">{profile.username}</span>
            </p>
          )}
        </div>
        <Link
          className="flex items-center justify-between rounded-3xl border border-line bg-panel/60 p-6 hover:border-brass"
          href="/settings/card"
        >
          <span>
            <span className="block text-lg font-black">My card</span>
            <span className="mt-1 block text-sm text-ink-faint">
              Upload your player photo and choose your archetype.
            </span>
          </span>
          <span className="text-2xl text-brass" aria-hidden="true">
            &rarr;
          </span>
        </Link>
        <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-6 text-center text-ink-faint">
          Notification preferences are planned for a later polish pass.
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}

import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function AccountsPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const service = createServiceClient();
  const [profilesResponse, usersResponse, eventsResponse] = await Promise.all([
    supabase.schema("kut").from("profiles").select("id, display_name, role, is_disabled").eq("is_disabled", false).order("display_name"),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.schema("kut").from("password_reset_events").select("id, target_user_id, reset_by, reason, status, created_at, completed_at").order("created_at", { ascending: false }).limit(10),
  ]);

  if (profilesResponse.error || usersResponse.error || eventsResponse.error) {
    throw new Error("Could not load account management details.");
  }

  const emailByUserId = new Map((usersResponse.data.users ?? []).map((user) => [user.id, user.email ?? "No email"]));
  const accounts = (profilesResponse.data ?? [])
    .filter((profile) => profile.id !== admin.id)
    .filter((profile) => admin.role === "superadmin" || profile.role === "user")
    .flatMap((profile) => {
      const email = emailByUserId.get(profile.id);
      return email ? [{ displayName: profile.display_name, email, id: profile.id, role: profile.role }] : [];
    });
  const displayNameByUserId = new Map((profilesResponse.data ?? []).map((profile) => [profile.id, profile.display_name]));

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-xl space-y-8">
        <div className="flex justify-end"><LogoutButton /></div>
        <Link className="text-sm font-semibold text-amber-400" href="/admin/attendance">← Admin attendance</Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Admin</p>
          <h1 className="text-4xl font-black tracking-tight">Account recovery</h1>
          <p className="text-slate-300">Set a temporary password for a member who cannot sign in. Every attempt is recorded; passwords are never logged.</p>
        </header>
        <ResetPasswordForm accounts={accounts} />
        {(eventsResponse.data ?? []).length > 0 && (
          <section className="space-y-3 border-t border-slate-800 pt-8">
            <h2 className="text-xl font-bold">Recent reset activity</h2>
            <ul className="space-y-2">
              {(eventsResponse.data ?? []).map((event) => (
                <li className="rounded-xl bg-slate-900 p-4 text-sm text-slate-300" key={event.id}>
                  <p className="font-semibold text-slate-50">{displayNameByUserId.get(event.target_user_id) ?? "Unknown member"} · {event.status}</p>
                  <p className="mt-1">{event.reason}</p>
                  <p className="mt-1">{new Date(event.created_at).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}

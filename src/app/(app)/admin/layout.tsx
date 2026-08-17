import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <>
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-10">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-amber-400">Admin</p>
          <AdminTabs />
        </div>
      </div>
      {children}
    </>
  );
}

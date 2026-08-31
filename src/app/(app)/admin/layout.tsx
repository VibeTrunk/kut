import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <>
      <div className="border-b border-line/40 bg-board-deep/80">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-10">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-brass">Admin</p>
          <AdminTabs />
        </div>
      </div>
      {children}
    </>
  );
}

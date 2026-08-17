import type { ReactNode } from "react";
import { AppNav } from "@/components/app-shell/app-nav";
import { getNavContext } from "@/lib/nav/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const nav = await getNavContext();

  return (
    <>
      <AppNav balance={nav.balance} displayName={nav.displayName} isAdmin={nav.isAdmin} unreadCount={nav.unreadCount} />
      <div className="pb-16 sm:pb-0">{children}</div>
    </>
  );
}

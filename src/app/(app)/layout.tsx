import type { ReactNode } from "react";
import { AppNav } from "@/components/app-shell/app-nav";
import { getNavContext } from "@/lib/nav/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const nav = await getNavContext();

  return (
    <>
      <AppNav balance={nav.balance} displayName={nav.displayName} incomingOfferCount={nav.incomingOfferCount} isAdmin={nav.isAdmin} unreadCount={nav.unreadCount} />
      {/* The bottom tab bar is ~57px of its own content PLUS
          `env(safe-area-inset-bottom)` (app-nav.tsx). A flat `pb-16` under-reserved
          by the inset, so on a phone with a home indicator the last ~30px of every
          page sat underneath the bar (KB-010). */}
      <div className="pb-[calc(4rem_+_env(safe-area-inset-bottom,0px))] sm:pb-0">{children}</div>
    </>
  );
}

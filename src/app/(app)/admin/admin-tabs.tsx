"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/economy", label: "Economy" },
  { href: "/admin/invites", label: "Invites" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              active ? "bg-brass/10 text-brass" : "text-ink-faint hover:text-ink"
            }`}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

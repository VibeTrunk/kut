import { SectionTabs } from "@/components/app-shell/section-tabs";
import type { RouteEntry } from "@/lib/nav/routes";

/**
 * Six tabs, so the flat `row` variant rather than a segmented control — at
 * 390px a segmented control would leave each tab about 60px wide.
 *
 * Targets grew from ~34px to the 44px `BUILD_SPEC.md` §52 asks for when this
 * moved onto `SectionTabs`, which makes the admin header slightly taller.
 */
const tabs: RouteEntry[] = [
  { key: "attendance", href: "/admin/attendance", label: "Attendance" },
  { key: "roster", href: "/admin/roster", label: "Roster" },
  { key: "links", href: "/admin/links", label: "Accounts" },
  { key: "accounts", href: "/admin/accounts", label: "Recovery" },
  { key: "economy", href: "/admin/economy", label: "Economy" },
  { key: "invites", href: "/admin/invites", label: "Invites" },
];

export function AdminTabs() {
  return <SectionTabs label="Admin" tabs={tabs} variant="row" />;
}

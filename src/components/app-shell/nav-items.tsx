import {
  IconAdmin,
  IconClub,
  IconCollection,
  IconDirectory,
  IconHome,
  IconInfo,
  IconLeaderboard,
  IconMarket,
  IconMessages,
  IconOffer,
  IconPack,
  IconScale,
  IconSessions,
  IconSettings,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive: (pathname: string) => boolean;
  adminOnly?: boolean;
  badgeCount?: number;
};

const exact = (target: string) => (pathname: string) => pathname === target;
const prefixed = (target: string) => (pathname: string) => pathname === target || pathname.startsWith(`${target}/`);

export const primaryNavItems: Omit<NavItem, "badgeCount">[] = [
  { href: "/", label: "Home", Icon: IconHome, isActive: exact("/") },
  { href: "/club/collection", label: "Collection", Icon: IconCollection, isActive: prefixed("/club/collection") },
  { href: "/club/packs", label: "Packs", Icon: IconPack, isActive: prefixed("/club/packs") },
  { href: "/market", label: "Market", Icon: IconMarket, isActive: prefixed("/market") },
  { href: "/club", label: "Club", Icon: IconClub, isActive: exact("/club") },
];

export function buildMoreNavItems(unreadCount: number, incomingOfferCount = 0): NavItem[] {
  return [
    { href: "/leaderboard", label: "Leaderboard", Icon: IconLeaderboard, isActive: prefixed("/leaderboard") },
    { href: "/sessions", label: "Sessions", Icon: IconSessions, isActive: prefixed("/sessions") },
    { href: "/club/value", label: "Club Value", Icon: IconScale, isActive: prefixed("/club/value") },
    { href: "/market/offers", label: "Trade offers", Icon: IconOffer, isActive: prefixed("/market/offers"), badgeCount: incomingOfferCount },
    { href: "/players", label: "Player directory", Icon: IconDirectory, isActive: prefixed("/players") },
    { href: "/messages", label: "Messages", Icon: IconMessages, isActive: prefixed("/messages"), badgeCount: unreadCount },
    { href: "/how-it-works", label: "How KUT works", Icon: IconInfo, isActive: prefixed("/how-it-works") },
    { href: "/settings", label: "Settings", Icon: IconSettings, isActive: prefixed("/settings") },
    { href: "/admin/attendance", label: "Admin", Icon: IconAdmin, isActive: prefixed("/admin"), adminOnly: true },
  ];
}

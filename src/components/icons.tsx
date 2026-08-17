import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return base(
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>,
    props,
  );
}

export function IconCollection(props: IconProps) {
  return base(
    <>
      <rect height="15" rx="1.6" transform="rotate(8 12.5 11)" width="11" x="7" y="3.5" />
      <rect fill="var(--icon-cutout, #020617)" height="15" rx="1.6" width="11" x="4.5" y="6" />
    </>,
    props,
  );
}

export function IconPack(props: IconProps) {
  return base(
    <>
      <path d="M4 8.5 12 4l8 4.5v8L12 21l-8-4.5z" />
      <path d="M4 8.5 12 13l8-4.5" />
      <path d="M12 13v8" />
    </>,
    props,
  );
}

export function IconMarket(props: IconProps) {
  return base(
    <>
      <path d="M3 8h13" />
      <path d="M13 4l4 4-4 4" />
      <path d="M21 16H8" />
      <path d="M11 20l-4-4 4-4" />
    </>,
    props,
  );
}

export function IconClub(props: IconProps) {
  return base(
    <>
      <path d="M12 3l7 2.5v5.2C19 15.8 16 19 12 21c-4-2-7-5.2-7-10.3V5.5z" />
      <path d="M12 8v6" />
      <path d="M9.2 10.8h5.6" />
    </>,
    props,
  );
}

export function IconLeaderboard(props: IconProps) {
  return base(
    <>
      <path d="M5 20V11" />
      <path d="M12 20V4" />
      <path d="M19 20v-7" />
    </>,
    props,
  );
}

export function IconDirectory(props: IconProps) {
  return base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.3c2 .4 3 1.9 3 4.7" />
    </>,
    props,
  );
}

export function IconMessages(props: IconProps) {
  return base(<path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z" />, props);
}

export function IconSettings(props: IconProps) {
  return base(
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M20 17h0" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>,
    props,
  );
}

export function IconAdmin(props: IconProps) {
  return base(
    <>
      <path d="M12 3l7 2.5v5.2C19 15.8 16 19 12 21c-4-2-7-5.2-7-10.3V5.5z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </>,
    props,
  );
}

export function IconCoin(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M9.5 10a2.3 2.3 0 0 1 2.5-1.6c1.4 0 2.4.7 2.4 1.8s-1 1.6-2.4 1.8c-1.4.2-2.4.8-2.4 1.8s1 1.8 2.4 1.8a2.4 2.4 0 0 0 2.5-1.6" />
    </>,
    props,
  );
}

export function IconChevronDown(props: IconProps) {
  return base(<path d="M7 10l5 5 5-5" />, { strokeWidth: 2, ...props });
}

export function IconMenu(props: IconProps) {
  return base(<path d="M4 7h16M4 12h16M4 17h16" />, { strokeWidth: 2, ...props });
}

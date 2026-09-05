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

export function IconUser(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
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

export function IconInfo(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h0" />
    </>,
    props,
  );
}

export function IconScale(props: IconProps) {
  return base(
    <>
      <path d="M12 4v16" />
      <path d="M7 20h10" />
      <path d="M5 7h14l-2.5-3h-9z" />
      <path d="M5 7 2.5 13a3 3 0 0 0 5 0z" />
      <path d="M19 7l-2.5 6a3 3 0 0 0 5 0z" />
    </>,
    props,
  );
}

export function IconChevronDown(props: IconProps) {
  return base(<path d="M7 10l5 5 5-5" />, { strokeWidth: 2, ...props });
}

export function IconSearch(props: IconProps) {
  return base(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>,
    props,
  );
}

export function IconSort(props: IconProps) {
  return base(
    <>
      <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
      <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
    </>,
    props,
  );
}

export function IconChronicle(props: IconProps) {
  return base(
    <>
      <path d="M4 6h11a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2h-1" />
      <path d="M7 9.5h5M7 12.5h5M7 15.5h3" />
    </>,
    props,
  );
}

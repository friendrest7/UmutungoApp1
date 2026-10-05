export type IconName =
  | 'arrow'
  | 'building'
  | 'check'
  | 'creditCard'
  | 'chevron'
  | 'download'
  | 'googlePlay'
  | 'apple'
  | 'instagram'
  | 'linkedin'
  | 'heart'
  | 'home'
  | 'leaf'
  | 'globe'
  | 'google'
  | 'bell'
  | 'bookPen'
  | 'menu'
  | 'moon'
  | 'pin'
  | 'search'
  | 'sparkles'
  | 'sun'
  | 'user'
  | 'users'
  | 'x';

type IconProps = { name: IconName; size?: number; strokeWidth?: number; filled?: boolean };

export function Icon({ name, size = 18, strokeWidth = 1.8, filled = false }: IconProps) {
  const common = { stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h13" {...common} /><path d="m13 6 6 6-6 6" {...common} /></>,
    building: <><path d="M4 21h16M6 21V5l6-3 6 3v16M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" fill="none" {...common} /></>,
    check: <path d="m5 12 4 4L19 6" fill="none" {...common} />,
    creditCard: <><rect x="3" y="5" width="18" height="14" rx="2" fill="none" {...common} /><path d="M3 10h18M7 15h3" fill="none" {...common} /></>,
    chevron: <path d="m6 9 6 6 6-6" fill="none" {...common} />,
    download: <><path d="M12 3v11M7 10l5 5 5-5M5 21h14" fill="none" {...common} /></>,
    googlePlay: <><path d="M3.6 2.5c-.4.5-.6 1.1-.6 1.9v15.2c0 .8.2 1.4.6 1.9L14.7 12 3.6 2.5Z" fill="#4285F4" /><path d="m15.8 13 3.2 1.8c1.1.6 1.1 1.8 0 2.4l-3.3 1.8-3.6-3 3.7-3Z" fill="#FBBC04" /><path d="m3.6 2.5 11.1 9.5-3.7 3L3.6 2.5Z" fill="#34A853" /><path d="m3.6 21.5 7.4-6.5 3.7 3-11.1 3.5Z" fill="#EA4335" /></>,
    apple: <path d="M16.8 12.7c0-2.5 2-3.7 2.1-3.8a4.5 4.5 0 0 0-3.5-1.9c-1.5-.2-2.9.9-3.6.9-.7 0-1.8-.9-3-.9a4.5 4.5 0 0 0-3.8 2.3c-1.6 2.8-.4 7 1.1 9.3.8 1.1 1.6 2.4 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.2 2.7-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.1-.8-2.1-3.2ZM14.5 5.5c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.2-.5.6-1 1.6-.9 2.5.9.1 1.9-.4 2.5-1Z" fill="currentColor" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" {...common} /><circle cx="12" cy="12" r="4.2" fill="none" {...common} /><circle cx="17.4" cy="6.7" r="1" fill="currentColor" /></>,
    linkedin: <><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="var(--surface)" /><path d="M7 10.5h2v6H7zM11 10.5h2v.9a3.1 3.1 0 0 1 2.5-1.2c2 0 3.5 1.3 3.5 4v2.3h-2v-2.1c0-1.2-.5-2.1-1.6-2.1-1.2 0-1.9.8-1.9 2.1v2.1h-2.5v-6Z" fill="var(--surface)" /></>,
    heart: <path d="M20.8 8.7c0 5.5-8.8 10-8.8 10s-8.8-4.5-8.8-10a4.4 4.4 0 0 1 8.8-1.5 4.4 4.4 0 0 1 8.8 1.5Z" fill={filled ? 'currentColor' : 'none'} {...common} />,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" fill="none" {...common} /><path d="M9 21v-6h6v6" fill="none" {...common} /></>,
    leaf: <><path d="M20 4C12 4 5 7 5 14c0 3.5 2.5 6 6 6 7 0 9-8 9-16Z" fill="none" {...common} /><path d="M4 21c3-5 7-8 12-10" fill="none" {...common} /></>,
    globe: <><circle cx="12" cy="12" r="9" fill="none" {...common} /><path d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3c-2.2 2.4-3.3 5.4-3.3 9s1.1 6.6 3.3 9" fill="none" {...common} /></>,
    google: <><path d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" fill="#4285F4" /><path d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.5Z" fill="#34A853" /><path d="M6.53 13.58A5.85 5.85 0 0 1 6.22 12c0-.55.11-1.08.31-1.58V7.89H3.28A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.06 1.03 4.11l3.25-2.53Z" fill="#FBBC04" /><path d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.45 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.11 9.46 6.39 12 6.39Z" fill="#EA4335" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" fill="none" {...common} /></>,
    bookPen: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z" fill="none" {...common} /><path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19M9 6h6M9 9h4M14.5 14.5l3.7-3.7 1.5 1.5-3.7 3.7-2.2.7.7-2.2Z" fill="none" {...common} /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" fill="none" {...common} /></>,
    moon: <path d="M20.7 15.1A8.6 8.6 0 0 1 8.9 3.3 8.6 8.6 0 1 0 20.7 15.1Z" fill={filled ? 'currentColor' : 'none'} {...common} />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" {...common} /><circle cx="12" cy="10" r="2" fill="none" {...common} /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" fill="none" {...common} /><path d="m16 16 5 5" fill="none" {...common} /></>,
    sparkles: <><path d="m12 3-1.7 5.3L5 10l5.3 1.7L12 17l1.7-5.3L19 10l-5.3-1.7L12 3Z" fill="none" {...common} /><path d="m19 16-.8 2.2L16 19l2.2.8L19 22l.8-2.2L22 19l-2.2-.8L19 16Z" fill="none" {...common} /></>,
    sun: <><circle cx="12" cy="12" r="4" fill="none" {...common} /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" {...common} /></>,
    user: <><circle cx="12" cy="8" r="3.2" fill="none" {...common} /><path d="M5 21c.5-4 3-6 7-6s6.5 2 7 6" fill="none" {...common} /></>,
    users: <><circle cx="9" cy="8" r="3" fill="none" {...common} /><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 5.5a3 3 0 0 1 0 5.8M18 14c1.8.8 3 2.5 3 5" fill="none" {...common} /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" fill="none" {...common} /></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">{paths[name]}</svg>;
}

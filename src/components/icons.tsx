// Stroke icons on a 24px grid in currentColor, one weight throughout, so the portal ships no icon library.
// Decorative by default (aria-hidden); give the button or link around an icon its accessible name.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const OverviewIcon = (p: P) => (<Svg {...p}><rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /></Svg>);
export const FileIcon = (p: P) => (<Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></Svg>);
export const UserIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>);
export const UserCircleIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3" /></Svg>);
export const UsersIcon = (p: P) => (<Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5" /></Svg>);
export const EyeIcon = (p: P) => (<Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
export const DownloadIcon = (p: P) => (<Svg {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Svg>);
export const LogoutIcon = (p: P) => (<Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></Svg>);
export const ChevronLeft = (p: P) => (<Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>);
export const ChevronRight = (p: P) => (<Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>);
export const SidebarIcon = (p: P) => (<Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9.5 4v16" /></Svg>);
export const MenuIcon = (p: P) => (<Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>);
export const ChevronUpDown = (p: P) => (<Svg {...p}><path d="m8 9 4-4 4 4M8 15l4 4 4-4" /></Svg>);
export const ChevronDown = (p: P) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
export const ClockIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
export const ShieldIcon = (p: P) => (<Svg {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>);
export const CheckIcon = (p: P) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>);
export const CloseIcon = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const AlertIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></Svg>);
export const InfoIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></Svg>);
export const CalendarIcon = (p: P) => (<Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>);
export const SearchIcon = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>);
export const SunIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Svg>);
export const MoonIcon = (p: P) => (<Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>);
export const MonitorIcon = (p: P) => (<Svg {...p}><rect x="3" y="4" width="18" height="12.5" rx="2" /><path d="M8.5 20.5h7M12 16.5v4" /></Svg>);
export const PhoneIcon = (p: P) => (<Svg {...p}><path d="M5 3.5h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.8 6.8L16 14l4.5 1.5V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z" /></Svg>);
export const MailIcon = (p: P) => (<Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></Svg>);
export const DropIcon = (p: P) => (<Svg {...p}><path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z" /></Svg>);
export const IdCardIcon = (p: P) => (<Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14.5 10h3.5M14.5 13.5h3.5" /></Svg>);
export const HelpIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" /></Svg>);
export const FlaskIcon = (p: P) => (<Svg {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3" /><path d="M7.5 15h9" /></Svg>);
export const ScanIcon = (p: P) => (<Svg {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3" /></Svg>);
export const RxIcon = (p: P) => (<Svg {...p}><path d="M6 3h12v18H6z" /><path d="M9 8h3a2 2 0 0 1 0 4H9V8zm0 4v4m3-4 3 4" /></Svg>);
export const ClipboardIcon = (p: P) => (<Svg {...p}><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 4.5V3.5h6v1M9 11h6M9 15h4" /></Svg>);
export const HeartIcon = (p: P) => (<Svg {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z" /><path d="M7 12h2.5l1.5-2 2 4 1.5-2H17" /></Svg>);
export const SyringeIcon = (p: P) => (<Svg {...p}><path d="m18 3 3 3M16.5 4.5l3 3M19 6 9 16l-3-3L16 3" /><path d="m11 8 2 2M8.5 10.5l2 2M6 13l-3 3v2h2l3-3M3 21l2-2" /></Svg>);
export const ImageIcon = (p: P) => (<Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.75" /><path d="m4 18 5-5 4 4 2.5-2.5L20 19" /></Svg>);

const DOC_ICONS = { file: FileIcon, flask: FlaskIcon, scan: ScanIcon, rx: RxIcon, clipboard: ClipboardIcon, heart: HeartIcon, syringe: SyringeIcon, image: ImageIcon };

/** The icon named in document_type.icon; anything unknown gets the plain file icon. */
export function DocTypeIcon({ name, ...p }: P & { name: string }) {
  const Icon = Object.hasOwn(DOC_ICONS, name) ? DOC_ICONS[name as keyof typeof DOC_ICONS] : FileIcon;
  return <Icon {...p} />;
}

export const UploadIcon = (p: P) => (<Svg {...p}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></Svg>);
export const PlusIcon = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const CopyIcon = (p: P) => (<Svg {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></Svg>);
export const KeyIcon = (p: P) => (<Svg {...p}><circle cx="8" cy="15" r="4.5" /><path d="m11.5 11.5 9-9M17 6l3 3M14.5 8.5l2 2" /></Svg>);
export const DotIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="2.5" /></Svg>);
export const TrashIcon = (p: P) => (<Svg {...p}><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></Svg>);
export const UndoIcon = (p: P) => (<Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>);
export const ReplaceIcon = (p: P) => (<Svg {...p}><path d="M4 9h13l-3-3M20 15H7l3 3" /></Svg>);
export const ActionsIcon = (p: P) => (<Svg {...p}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></Svg>);

// The sidebar's icon names, as GET /api/session sends them (patient360-api src/lib/navigation.ts NAV_ICONS).
const NAV_ICONS = { overview: OverviewIcon, records: FileIcon, profile: UserIcon, patients: UsersIcon, lab: FlaskIcon, audit: ShieldIcon, upload: UploadIcon, users: IdCardIcon, actions: ActionsIcon };

/** The icon for a nav item; an unknown name draws a dot, so a new item still shows. */
export function NavIcon({ name, ...p }: P & { name: string }) {
  const Icon = Object.hasOwn(NAV_ICONS, name) ? NAV_ICONS[name as keyof typeof NAV_ICONS] : DotIcon;
  return <Icon {...p} />;
}

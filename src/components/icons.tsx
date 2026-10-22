// Small stroke icons (24px grid, currentColor), so the portal ships no icon library.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (<Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Svg>);
export const FileIcon = (p: P) => (<Svg {...p}><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></Svg>);
export const UserIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>);
export const EyeIcon = (p: P) => (<Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
export const DownloadIcon = (p: P) => (<Svg {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Svg>);
export const LogoutIcon = (p: P) => (<Svg {...p}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></Svg>);
export const ChevronLeft = (p: P) => (<Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>);
export const ChevronRight = (p: P) => (<Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>);
export const ClockIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
export const ShieldIcon = (p: P) => (<Svg {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>);
export const UsersIcon = (p: P) => (<Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5" /></Svg>);
export const CloseIcon = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const FlaskIcon = (p: P) => (<Svg {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3" /><path d="M7.5 15h9" /></Svg>);
export const ScanIcon = (p: P) => (<Svg {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3" /></Svg>);
export const RxIcon = (p: P) => (<Svg {...p}><path d="M6 3h12v18H6z" /><path d="M9 8h3a2 2 0 0 1 0 4H9V8zm0 4v4m3-4 3 4" /></Svg>);
export const AlertIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></Svg>);
export const CalendarIcon = (p: P) => (<Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>);

/** Icon per document type code; anything unknown gets the plain file icon. */
export function DocTypeIcon({ code, ...p }: P & { code: string }) {
  if (code === "BLOOD_REPORT") return <FlaskIcon {...p} />;
  if (code === "ULTRASOUND_REPORT") return <ScanIcon {...p} />;
  if (code === "PRESCRIPTION") return <RxIcon {...p} />;
  return <FileIcon {...p} />;
}

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Контурная иконка 24×24 в стиле Альфа: обводка currentColor */
const LineIcon = ({ children, ...props }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    {children}
  </svg>
)

const ServicesIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden {...props}>
    <circle cx="7" cy="7" r="3.2" fill="#EF3124" />
    <circle cx="17" cy="7" r="3.2" fill="#0F1A24" />
    <circle cx="7" cy="17" r="3.2" fill="#0F1A24" />
    <circle cx="17" cy="17" r="3.2" fill="#EF3124" />
  </svg>
)

const RequestsIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </LineIcon>
)

const PlusIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M12 5v14M5 12h14" />
  </LineIcon>
)

const FeedIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m3.5 7.5 8.5 6 8.5-6" />
  </LineIcon>
)

const ClockIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </LineIcon>
)

const FileIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" />
    <path d="M14 3v5h5" />
  </LineIcon>
)

const FileSearchIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H11" />
    <path d="M14 3v5h5v3" />
    <circle cx="16" cy="16" r="2.5" />
    <path d="m18 18 2.5 2.5" />
  </LineIcon>
)

const FileDownloadIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
  </LineIcon>
)

const FilePlusIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M12 9v6M9 12h6" />
  </LineIcon>
)

const ListIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </LineIcon>
)

const UsersIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
    <path d="M16 5.5a3 3 0 0 1 0 6M18 14.5c1.8.6 3 2.2 3 4.5" />
  </LineIcon>
)

const CertificateIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H10" />
    <path d="M14 3v5h5v2" />
    <path d="M13 21l2-5 2 3 2-3 2 5" />
  </LineIcon>
)

const InvoiceIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </LineIcon>
)

const CardIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 10h18M7 15h3" />
  </LineIcon>
)

const ProcurementIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </LineIcon>
)

const GearIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </LineIcon>
)

const MailIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </LineIcon>
)

const BellIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </LineIcon>
)

const PanelIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M14 4v16" />
  </LineIcon>
)

const ChevronRightIcon = (props: IconProps) => (
  <LineIcon strokeWidth="2.2" {...props}>
    <path d="m9 5 7 7-7 7" />
  </LineIcon>
)

const CloseIcon = (props: IconProps) => (
  <LineIcon strokeWidth="2" {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </LineIcon>
)

const EyeIcon = (props: IconProps) => (
  <LineIcon strokeWidth="2" {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </LineIcon>
)

const EyeOffIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
  </LineIcon>
)

const CupIcon = (props: IconProps) => (
  <LineIcon strokeWidth="1.8" {...props}>
    <path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
    <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
    <path d="M8.5 3.5c-.8.8-.8 1.7 0 2.5M11.5 3.5c-.8.8-.8 1.7 0 2.5" />
  </LineIcon>
)

const ChatIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden {...props}>
    <path d="M12 3.5c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.5 20l1.2-3.6C4 15 3 13.1 3 11.1 3 6.8 7 3.5 12 3.5z" fill="currentColor" />
    <path d="M8 10h8M8 13h5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

export {
  ServicesIcon, RequestsIcon, PlusIcon, FeedIcon, ClockIcon, FileIcon, FileSearchIcon,
  FileDownloadIcon, FilePlusIcon, ListIcon, UsersIcon, CertificateIcon, InvoiceIcon, CardIcon,
  ProcurementIcon, GearIcon, MailIcon, BellIcon, PanelIcon, ChevronRightIcon, CloseIcon,
  EyeIcon, EyeOffIcon, CupIcon, ChatIcon,
};

import type { SVGProps } from 'react'

// Bộ icon SVG nội tuyến (stroke = currentColor để đổi màu theo CSS)

type IconProps = SVGProps<SVGSVGElement>
export type IconComponent = (props: IconProps) => React.JSX.Element

function Base({ children, ...props }: IconProps): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11h14V9" />
  </Base>
)

export const GridIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
)

export const GlobeIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </Base>
)

// Lưới ảnh bìa dọc (kiểu thư viện Steam)
export const PosterGridIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <rect x="3" y="3" width="5" height="8" rx="1" />
    <rect x="9.5" y="3" width="5" height="8" rx="1" />
    <rect x="16" y="3" width="5" height="8" rx="1" />
    <rect x="3" y="13" width="5" height="8" rx="1" />
    <rect x="9.5" y="13" width="5" height="8" rx="1" />
    <rect x="16" y="13" width="5" height="8" rx="1" />
  </Base>
)

// Thẻ game ngang
export const CardsIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <rect x="3" y="4" width="8" height="7" rx="1.5" />
    <rect x="13" y="4" width="8" height="7" rx="1.5" />
    <path d="M3 15h8M3 19h5M13 15h8M13 19h5" />
  </Base>
)

export const DownloadIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 20h16" />
  </Base>
)

export const GearIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Base>
)

export const SearchIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
)

export const PlayIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" />
  </Base>
)

export const ShuffleIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="m15 15 6 6" />
    <path d="M4 4l5 5" />
  </Base>
)

export const ClockIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)

export const StarIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z" />
  </Base>
)

export const LayersIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Base>
)

export const UsersIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
  </Base>
)

export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Base>
)

export const XIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Base>
)

export const FolderIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </Base>
)

export const PencilIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Base>
)

export const TrashIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </Base>
)

export const SaveIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <path d="m5 12 5 5L20 7" />
  </Base>
)

export const ImageIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Base>
)

export const HelpIcon = (p: IconProps): React.JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
    <path d="M12 17h.01" />
  </Base>
)

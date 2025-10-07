import React from "react";

type IconProps = {
  size?: number;
  className?: string;
};

const Svg: React.FC<React.PropsWithChildren<IconProps>> = ({ size = 16, className, children }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const Map: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polygon points="1 6 9 2 15 6 23 2 23 18 15 22 9 18 1 22 1 6" />
    <line x1="9" y1="2" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="22" />
  </Svg>
);

export const MessageCircle: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M21 11.5a8.5 8.5 0 1 1-4.2-7.4L22 3l-2 4.5a8.43 8.43 0 0 1 1 4" />
  </Svg>
);

export const StickyNote: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M17 13v6h-6" />
  </Svg>
);

export const Plus: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const Minus: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const X: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const Search: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

export const ExternalLink: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </Svg>
);

export const Undo2: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20a8 8 0 0 0-7-11H4" />
  </Svg>
);

export const Redo2: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polyline points="15 14 20 9 15 4" />
    <path d="M4 20a8 8 0 0 1 7-11h9" />
  </Svg>
);

export const Bot: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="7" y="9" width="10" height="8" rx="2" />
    <rect x="9" y="11" width="2" height="2" />
    <rect x="13" y="11" width="2" height="2" />
    <path d="M12 3v3" />
    <circle cx="12" cy="6" r="1" />
  </Svg>
);

export const Clock: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </Svg>
);

export const User: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
  </Svg>
);

export const Trash2: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const GripVertical: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
  </Svg>
);

export const GitBranch: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M9 6h6a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6H6" />
  </Svg>
);

export const ChevronDown: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const Copy: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <rect x="2" y="2" width="13" height="13" rx="2" />
  </Svg>
);

export const Home: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 12l9-9 9 9" />
    <path d="M9 21V9h6v12" />
  </Svg>
);



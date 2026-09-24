// Lightweight inline SVG icon set (no new dependency).
// 1.75px stroke, round caps — consistent 16–18px rendering via CSS.
function base(props, path) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {path}
    </svg>
  );
}

export const SearchIcon = (p) => base(p, <g><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></g>);
export const SendIcon = (p) => base(p, <g><path d="M21 3 10.5 13.5" /><path d="M21 3 14 21l-3.5-7.5L3 10 21 3Z" /></g>);
export const ClipIcon = (p) => base(p, <path d="m21 11-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 3.4a3.7 3.7 0 0 1 5.2 5.2l-8.2 8.2a1.85 1.85 0 0 1-2.6-2.6L14.5 7" />);
export const MicIcon = (p) => base(p, <g><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></g>);
export const VideoIcon = (p) => base(p, <g><rect x="3" y="7" width="12" height="10" rx="2.5" /><path d="m15 10.5 6-3.5v10l-6-3.5" /></g>);
export const BackIcon = (p) => base(p, <g><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></g>);
export const LogoutIcon = (p) => base(p, <g><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></g>);
export const CloseIcon = (p) => base(p, <g><path d="M18 6 6 18M6 6l12 12" /></g>);
export const ChatIcon = (p) => base(p, <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />);
export const PeopleIcon = (p) => base(p, <g><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.2a6.5 6.5 0 0 1 4 5.8" /></g>);
export const UserIcon = (p) => base(p, <g><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>);
export const CopyIcon = (p) => base(p, <g><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></g>);
export const ReplyIcon = (p) => base(p, <g><path d="M9 17 4 12l5-5" /><path d="M4 12h9a7 7 0 0 1 7 7v1" /></g>);
export const CheckIcon = (p) => base(p, <path d="m4.5 12.5 5 5 10-11" />);
export const ChevronDownIcon = (p) => base(p, <g><path d="m6 9 6 6 6-6" /></g>);

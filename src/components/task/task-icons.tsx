"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type TaskViewMode = "list" | "grid" | "kanban" | "gantt" | "calendar";

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function TaskViewIcon({ mode, ...props }: IconProps & { mode: TaskViewMode }) {
  switch (mode) {
    case "list":
      return (
        <BaseIcon {...props}>
          <path d="M8 6h11" />
          <path d="M8 12h11" />
          <path d="M8 18h11" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </BaseIcon>
      );
    case "grid":
      return (
        <BaseIcon {...props}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </BaseIcon>
      );
    case "kanban":
      return (
        <BaseIcon {...props}>
          <path d="M5 6v12" />
          <path d="M12 10v8" />
          <path d="M19 4v14" />
          <path d="M3 18h18" />
        </BaseIcon>
      );
    case "gantt":
      return (
        <BaseIcon {...props}>
          <path d="M4 6h6" />
          <path d="M4 12h10" />
          <path d="M4 18h4" />
          <rect x="12" y="4.5" width="8" height="3" rx="1.5" />
          <rect x="16" y="10.5" width="4" height="3" rx="1.5" />
          <rect x="10" y="16.5" width="8" height="3" rx="1.5" />
        </BaseIcon>
      );
    case "calendar":
      return (
        <BaseIcon {...props}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
          <path d="M8 14h3" />
          <path d="M13 14h3" />
          <path d="M8 17h3" />
          <path d="M13 17h3" />
        </BaseIcon>
      );
    default:
      return null;
  }
}

export function CommentBubbleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 18.5 4.5 20l.8-3.1A7 7 0 1 1 19 12a7 7 0 0 1-12 6.5Z" />
    </BaseIcon>
  );
}

export function EmptyInboxIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" />
      <path d="M4 13h4l2 3h4l2-3h4" />
    </BaseIcon>
  );
}

export function CreatedAtIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
      <path d="M12 13v4" />
      <path d="M10 15h4" />
    </BaseIcon>
  );
}

export function UpdatedAtIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M6.5 9A7 7 0 0 1 18 6" />
      <path d="M17.5 15A7 7 0 0 1 6 18" />
    </BaseIcon>
  );
}

export function StartDateIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="6.5" cy="12" r="2.5" />
      <path d="M10 12h10" />
      <path d="m16 8 4 4-4 4" />
    </BaseIcon>
  );
}

export function DueDateIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 20V4" />
      <path d="M5 5h11l-2.5 4 2.5 4H5" />
    </BaseIcon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 5h16l-6 8v6l-4-2v-4Z" />
    </BaseIcon>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4v16" />
      <path d="m4 7 3-3 3 3" />
      <path d="M17 20V4" />
      <path d="m14 17 3 3 3-3" />
    </BaseIcon>
  );
}

export function SortAscendingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 19V5" />
      <path d="m5 8 3-3 3 3" />
      <path d="M15 17h4" />
      <path d="M15 12h6" />
      <path d="M15 7h8" />
    </BaseIcon>
  );
}

export function SortDescendingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 5v14" />
      <path d="m5 16 3 3 3-3" />
      <path d="M15 17h8" />
      <path d="M15 12h6" />
      <path d="M15 7h4" />
    </BaseIcon>
  );
}

export function DragHandleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 6h.01" />
      <path d="M9 12h.01" />
      <path d="M9 18h.01" />
      <path d="M15 6h.01" />
      <path d="M15 12h.01" />
      <path d="M15 18h.01" />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </BaseIcon>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4 3.5 19h17Z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </BaseIcon>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6" />
      <path d="m15 9-6 6" />
    </BaseIcon>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </BaseIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </BaseIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4a12 12 0 0 1 0 16" />
      <path d="M12 4a12 12 0 0 0 0 16" />
    </BaseIcon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2.5h6.5A1.5 1.5 0 0 1 20 9v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
    </BaseIcon>
  );
}

export function GroupIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="5" width="6" height="5" rx="1.5" />
      <rect x="14" y="5" width="6" height="5" rx="1.5" />
      <rect x="4" y="14" width="6" height="5" rx="1.5" />
      <rect x="14" y="14" width="6" height="5" rx="1.5" />
    </BaseIcon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="m13 7 4 4" />
    </BaseIcon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </BaseIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m15 6-6 6 6 6" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="m5.6 5.6 1.4 1.4" />
      <path d="m17 17 1.4 1.4" />
      <path d="m18.4 5.6-1.4 1.4" />
      <path d="m7 17-1.4 1.4" />
    </BaseIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </BaseIcon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.7-3.4 3.2-5.5 7-5.5s6.3 2.1 7 5.5" />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </BaseIcon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </BaseIcon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9 6 9 6a13.5 13.5 0 0 1-2.1 3" />
      <path d="M6.2 6.2C4.1 7.6 3 12 3 12s3 6 9 6c1 0 1.9-.2 2.7-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </BaseIcon>
  );
}

export function DotsHorizontalIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 12h.01" />
      <path d="M12 12h.01" />
      <path d="M18 12h.01" />
    </BaseIcon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </BaseIcon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </BaseIcon>
  );
}

export function FieldsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
      <path d="M10 5v14" />
    </BaseIcon>
  );
}

export function HierarchyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="3" width="6" height="4" rx="1" />
      <rect x="4" y="13" width="6" height="4" rx="1" />
      <rect x="14" y="13" width="6" height="4" rx="1" />
      <path d="M7 7v6" />
      <path d="M7 13H17v-2" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 4H4v4" />
      <path d="M16 4h4v4" />
      <path d="M8 20H4v-4" />
      <path d="M16 20h4v-4" />
    </BaseIcon>
  );
}

export function CheckSmallIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </BaseIcon>
  );
}

export function ProjectTabIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2.5h6.5A1.5 1.5 0 0 1 20 9v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
    </BaseIcon>
  );
}

export function MembersTabIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 19c.5-3 2.7-5 6-5s5.5 2 6 5" />
      <path d="M14.5 19c.4-2.2 1.6-3.5 3.5-3.5S21 16.8 21 19" />
    </BaseIcon>
  );
}

export function TrashTabIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </BaseIcon>
  );
}

export function CalendarTabIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
    </BaseIcon>
  );
}

export function TodayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="8" y="12" width="8" height="6" rx="1.5" fill="currentColor" stroke="none" opacity="0.22" />
      <path d="M10 15h4" />
    </BaseIcon>
  );
}

export function AdminTabIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 5 6v5c0 4.2 2.8 7.9 7 10 4.2-2.1 7-5.8 7-10V6l-7-3Z" />
      <path d="M9.5 12.5 11 14l3.5-4" />
      <path d="M8 18.2 10.5 15.7" />
      <path d="M16 18.2 13.5 15.7" />
    </BaseIcon>
  );
}

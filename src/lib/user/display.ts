export type DisplayUser = {
  id: string;
  name: string;
  shortName?: string | null;
  avatarUpdatedAt?: Date | string | null;
};

export function getDisplayName(user: DisplayUser): string {
  const short = user.shortName?.trim();
  if (short && short.length > 0) return short;
  return user.name.trim();
}

export function shouldShowFullNameTooltip(user: DisplayUser): boolean {
  const short = user.shortName?.trim();
  if (!short || short.length === 0) return false;
  return short !== user.name.trim();
}

// Detects CJK characters (Hiragana, Katakana, CJK Unified, Hangul) using
// unicode escape sequences — avoids embedding literal CJK glyphs which the
// i18n hardcode check forbids in source.
const CJK_REGEX = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

export function getInitials(user: DisplayUser): string {
  const source = (user.shortName?.trim() || user.name.trim() || "?").trim();
  if (!source) return "?";
  if (CJK_REGEX.test(source)) {
    return source.slice(0, 1);
  }
  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0]!.slice(0, 2).toUpperCase();
  return (tokens[0]![0]! + tokens[tokens.length - 1]![0]!).toUpperCase();
}

export function getAvatarUrl(user: DisplayUser): string | null {
  if (!user.avatarUpdatedAt) return null;
  const ts = user.avatarUpdatedAt instanceof Date
    ? user.avatarUpdatedAt.getTime()
    : new Date(user.avatarUpdatedAt).getTime();
  if (Number.isNaN(ts)) return null;
  return `/api/me/avatar/${encodeURIComponent(user.id)}?v=${ts}`;
}

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export function getAvatarColor(user: DisplayUser): string {
  let hash = 0;
  for (let i = 0; i < user.id.length; i += 1) {
    hash = (hash << 5) - hash + user.id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index]!;
}

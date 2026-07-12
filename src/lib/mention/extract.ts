import {
  BODY_MENTION_ID_REGEX,
  BODY_MENTION_ISSUE_REGEX,
  LEGACY_HANDLE_REGEX_G,
} from "./regex";

export type MentionRefType = "user" | "issue";

export interface MentionRef {
  type: MentionRefType;
  id: string;
}

export function extractBodyMentionIds(markdown: string): string[] {
  const out = new Set<string>();
  for (const m of markdown.matchAll(BODY_MENTION_ID_REGEX)) {
    out.add(m[1]);
  }
  return Array.from(out);
}

// Extract every typed mention reference in canonical order. Deduplicated
// per (type, id). Caller is responsible for permission-filtering via
// resolveMentionRefs.
export function extractBodyMentionRefs(markdown: string): MentionRef[] {
  const seen = new Set<string>();
  const out: MentionRef[] = [];
  const pushRef = (type: MentionRefType, id: string) => {
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, id });
  };
  for (const m of markdown.matchAll(BODY_MENTION_ID_REGEX)) pushRef("user", m[1]);
  for (const m of markdown.matchAll(BODY_MENTION_ISSUE_REGEX)) pushRef("issue", m[1]);
  return out;
}

export function extractLegacyHandles(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(LEGACY_HANDLE_REGEX_G)) {
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

// Typed mentions are serialized as `user:ID` / `issue:ID`.
// Legacy pre-0.25 rows contain bare User.id strings — `parseMentionIds` keeps
// returning those as-is (they're treated as `user` type on read).
export function serializeMentionIds(ids: string[]): string {
  return JSON.stringify(Array.from(new Set(ids)));
}

export function serializeMentionRefs(refs: MentionRef[]): string {
  const uniq = new Map<string, MentionRef>();
  for (const ref of refs) uniq.set(`${ref.type}:${ref.id}`, ref);
  return JSON.stringify(Array.from(uniq.values()).map((r) => `${r.type}:${r.id}`));
}

export function parseMentionIds(serialized: string | null | undefined): string[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

// Parse a typed mentions array from storage. Bare User.ids (pre-0.25 rows) are
// treated as `user` type for backward compatibility.
export function parseMentionRefs(serialized: string | null | undefined): MentionRef[] {
  const raw = parseMentionIds(serialized);
  return raw.map((entry) => {
    const colon = entry.indexOf(":");
    if (colon === -1) return { type: "user", id: entry };
    const type = entry.slice(0, colon);
    const id = entry.slice(colon + 1);
    if (type === "user" || type === "issue") {
      return { type, id };
    }
    return { type: "user", id: entry };
  });
}

// Filter typed mentions down to User.id strings. Used by notification
// dispatchers and legacy callers that only care about users.
export function filterUserMentionIds(refs: MentionRef[]): string[] {
  return refs.filter((r) => r.type === "user").map((r) => r.id);
}

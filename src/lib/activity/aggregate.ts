export interface ActivityCursorItem {
  id: string;
  createdAt: string | Date;
}

export function encodeActivityCursor(item: ActivityCursorItem): string {
  return `${new Date(item.createdAt).toISOString()}::${item.id}`;
}

export function decodeActivityCursor(cursor: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [rawDate, id] = cursor.split("::");
  const createdAt = new Date(rawDate);
  if (!id || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

export function compareActivityItems(a: ActivityCursorItem, b: ActivityCursorItem): number {
  const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (byDate !== 0) return byDate;
  return b.id.localeCompare(a.id);
}

export function paginateActivityItems<T extends ActivityCursorItem>(
  items: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const sorted = [...items].sort(compareActivityItems);
  const trimmed = sorted.slice(0, limit);
  return {
    items: trimmed,
    nextCursor: sorted.length > limit && trimmed.length > 0
      ? encodeActivityCursor(trimmed[trimmed.length - 1]!)
      : null,
  };
}

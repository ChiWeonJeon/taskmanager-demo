import test from "node:test";
import assert from "node:assert/strict";
import { decodeActivityCursor, paginateActivityItems } from "./aggregate";

test("aggregate activity pagination sorts by createdAt desc then id desc", () => {
  const page = paginateActivityItems(
    [
      { id: "a", createdAt: "2026-06-29T01:00:00.000Z" },
      { id: "c", createdAt: "2026-06-29T02:00:00.000Z" },
      { id: "b", createdAt: "2026-06-29T02:00:00.000Z" },
    ],
    2,
  );

  assert.deepEqual(page.items.map((item) => item.id), ["c", "b"]);
  assert.deepEqual(decodeActivityCursor(page.nextCursor)?.id, "b");
});

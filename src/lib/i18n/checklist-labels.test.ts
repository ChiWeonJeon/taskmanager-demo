import assert from "node:assert/strict";
import test from "node:test";
import { getLocaleMessages } from "@/lib/i18n/messages";

test("checklist create labels do not duplicate the plus icon", () => {
  for (const locale of ["en", "ko", "ja"] as const) {
    const label = getLocaleMessages(locale).checklist.hub.newButton;
    assert.equal(label.startsWith("+"), false);
  }
});

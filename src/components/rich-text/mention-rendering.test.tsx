import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/shared/locale-provider";
import { RichTextRenderer } from "@/components/rich-text/rich-text-renderer";
import { insertMentionTriggerText } from "@/components/rich-text/markdown-source-editor";
import { extractBodyMentionRefs } from "@/lib/mention/extract";
import type { ResolvedMentionRefs } from "@/lib/mention/resolve-refs";

function render(content: string, mentionRefs?: ResolvedMentionRefs | null) {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <RichTextRenderer content={content} mentionRefs={mentionRefs} />
    </LocaleProvider>
  );
}

describe("mention rendering", () => {
  it("renders unresolved issue mentions as raw chips, not missing resources", () => {
    const html = render("[#TASK-1](issue:issue1)");

    assert.match(html, /mention-issue/);
    assert.doesNotMatch(html, /mention-missing/);
  });

  it("renders resolved issue mentions as app links", () => {
    const html = render("[#TASK-1](issue:issue1)", {
      users: {},
      issues: {
        issue1: {
          id: "issue1",
          issueKey: "TASK-1",
          title: "Fix mentions",
          projectKey: "PRJ",
          isDeleted: false,
        },
      },
    });

    assert.match(html, /href="\/projects\/PRJ\/tasks\?task=issue1"/);
    assert.doesNotMatch(html, /mention-missing/);
  });
});

describe("rich text html table fallback", () => {
  it("renders sanitized html tables with nested lists", () => {
    const html = render(
      [
        "<table>",
        "<tbody>",
        "<tr><th>Column</th></tr>",
        "<tr><td><ul><li>kept bullet</li></ul><script>bad()</script></td></tr>",
        "</tbody>",
        "</table>",
      ].join("")
    );

    assert.match(html, /<table>/);
    assert.match(html, /<ul>/);
    assert.match(html, /kept bullet/);
    assert.doesNotMatch(html, /node="\[object Object\]"/);
    assert.doesNotMatch(html, /<script/);
  });
});

describe("markdown source mention helpers", () => {
  it("prepends a space when a toolbar trigger is inserted after a word", () => {
    assert.deepEqual(insertMentionTriggerText("hello", 5, 5, "@"), {
      value: "hello @",
      caret: 7,
    });
  });

  it("keeps trigger insertion unchanged at a whitespace boundary", () => {
    assert.deepEqual(insertMentionTriggerText("hello ", 6, 6, "#"), {
      value: "hello #",
      caret: 7,
    });
  });

  it("extracts canonical typed mention refs", () => {
    assert.deepEqual(
      extractBodyMentionRefs("[@Ada](user:u1) [#TASK-1](issue:i1)"),
      [
        { type: "user", id: "u1" },
        { type: "issue", id: "i1" },
      ]
    );
  });
});

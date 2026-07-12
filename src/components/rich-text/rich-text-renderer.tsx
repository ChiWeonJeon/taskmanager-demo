"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment, useMemo } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
  type UrlTransform,
} from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { LEGACY_HANDLE_REGEX_G } from "@/lib/mention/regex";
import type { ResolvedMentionRefs, ResolvedUserRef } from "@/lib/mention/resolve-refs";
import { useI18n } from "@/components/shared/locale-provider";
import { UserName } from "@/components/user/user-name";

// Allow our custom mention protocols on <a href> so react-markdown passes them
// through the custom renderer instead of stripping them.
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "colgroup", "col"],
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: [...(defaultSchema.protocols?.href ?? []), "user", "issue"],
  },
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    col: [...(defaultSchema.attributes?.col ?? []), "span", "width"],
    td: [...(defaultSchema.attributes?.td ?? []), "colSpan", "rowSpan", "colspan", "rowspan", "colwidth", "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "colSpan", "rowSpan", "colspan", "rowspan", "colwidth", "align"],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ["className"],
      ["dataUserId"],
      ["dataIssueId"],
    ],
  },
};

const richTextUrlTransform: UrlTransform = (url, key) => {
  if (key === "href" && /^(user|issue):/.test(url)) return url;
  return defaultUrlTransform(url);
};

function decorateLegacyHandles(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return splitHandles(children);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => <Fragment key={i}>{decorateLegacyHandles(c)}</Fragment>);
  }
  return children;
}

function splitHandles(text: string): ReactNode {
  if (!text || !text.includes("@")) return text;
  const re = new RegExp(LEGACY_HANDLE_REGEX_G.source, "g");
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const before = start === 0 ? "" : text[start - 1];
    if (before !== "" && !/\s/.test(before)) continue;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <span
        key={`mention-${i++}`}
        className="rich-text-mention"
        data-legacy-mention
      >
        @{m[1]}
      </span>
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function buildComponents(resolved: ResolvedMentionRefs | null, deletedLabel: string): Components {
  return {
    a({ href, children, node: _node, ...rest }) {
      void _node;
      if (typeof href === "string" && href.startsWith("user:")) {
        const userId = href.slice("user:".length);
        const ref: ResolvedUserRef | undefined = resolved?.users[userId];
        if (ref) {
          return (
            <span
              data-user-id={userId}
              className="rich-text-mention inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-light)] px-1.5 py-0.5 align-baseline text-[var(--color-accent)]"
            >
              <UserName user={ref} withAvatar avatarSize="xs" truncate={false} />
            </span>
          );
        }
        return (
          <a
            href={`user:${userId}`}
            data-user-id={userId}
            className="rich-text-mention"
            onClick={(e) => e.preventDefault()}
          >
            {children}
          </a>
        );
      }
      if (typeof href === "string" && href.startsWith("issue:")) {
        const issueId = href.slice("issue:".length);
        const ref = resolved?.issues[issueId];
        if (ref && !ref.isDeleted && ref.projectKey) {
          // `?task=ID` matches the convention used by notification deep links
          // (see src/lib/notifications/render.ts:80). TaskWorkspace reads this
          // query and auto-opens the detail panel, replacing whatever is open.
          return (
            <Link
              href={`/projects/${ref.projectKey}/tasks?task=${encodeURIComponent(issueId)}`}
              prefetch={false}
              data-issue-id={issueId}
              className="mention-issue"
              title={ref.title}
            >
              #{ref.issueKey}
            </Link>
          );
        }
        if (!resolved) {
          return (
            <span data-issue-id={issueId} className="mention-issue">
              {children}
            </span>
          );
        }
        return (
          <span className="mention-issue mention-missing" title={deletedLabel}>
            {children}
          </span>
        );
      }
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
    p({ children, node: _node, ...rest }) {
      void _node;
      return <p {...rest}>{decorateLegacyHandles(children)}</p>;
    },
    li({ children, node: _node, ...rest }) {
      void _node;
      return <li {...rest}>{decorateLegacyHandles(children)}</li>;
    },
    td({ children, node: _node, ...rest }) {
      void _node;
      return <td {...rest}>{decorateLegacyHandles(children)}</td>;
    },
    th({ children, node: _node, ...rest }) {
      void _node;
      return <th {...rest}>{decorateLegacyHandles(children)}</th>;
    },
  };
}

export interface RichTextRendererProps {
  content: string;
  emptyPlaceholder?: string;
  className?: string;
  // Resolved display metadata for mentions. Prefetch with
  // `resolveMentionRefsForRender(markdown)` on the server. When omitted, such
  // links fall back to their raw label (no deep link).
  mentionRefs?: ResolvedMentionRefs | null;
}

export function RichTextRenderer({
  content,
  emptyPlaceholder,
  className,
  mentionRefs,
}: RichTextRendererProps) {
  const { messages } = useI18n();
  const body = useMemo(() => {
    const trimmed = content?.trim() ?? "";
    if (trimmed) return content;
    return emptyPlaceholder ? `_${emptyPlaceholder}_` : "";
  }, [content, emptyPlaceholder]);

  const deletedLabel = messages.commonUi.richTextDeletedLabel;
  const components = useMemo(
    () => buildComponents(mentionRefs ?? null, deletedLabel),
    [mentionRefs, deletedLabel]
  );

  return (
    <div className={`rich-text-prose max-w-none ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]}
        urlTransform={richTextUrlTransform}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

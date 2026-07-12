"use client";

import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { ComponentType } from "react";
import { resolveFloatingPosition, type FloatingRect } from "@/lib/floating-position";
import { MentionList, type MentionListHandle, type MentionListProps, type MentionUser } from "./mention-list";
import {
  IssueMentionList,
  type IssueMentionItem,
  type IssueMentionListHandle,
  type IssueMentionListProps,
} from "./issue-mention-list";

interface BaseListProps<T> {
  items: T[];
  command: (item: { id: string; label: string }) => void;
  emptyMessage?: string;
}

interface BaseListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

function toFloatingRect(rect: DOMRect): FloatingRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function createSuggestionRenderer<T, H extends BaseListHandle, P extends BaseListProps<T>>(
  Component: ComponentType<P>,
  fetchItems: (query: string) => Promise<T[]>,
  emptyMessage?: string
) {
  return {
    items: async ({ query }: { query: string }) => {
      try {
        return await fetchItems(query ?? "");
      } catch {
        return [];
      }
    },
    render: () => {
      let reactRenderer: ReactRenderer<H, P> | null = null;
      let popup: HTMLDivElement | null = null;

      const placePopup = (rect: DOMRect) => {
        if (!popup) return;
        const preferredWidth = Math.min(280, Math.max(0, window.innerWidth - 16));
        const popupRect = popup.getBoundingClientRect();
        const position = resolveFloatingPosition(
          toFloatingRect(rect),
          {
            width: popupRect.width || preferredWidth,
            height: popupRect.height || 0,
          },
          {
            placement: "bottom",
            align: "start",
            preferredWidth,
            maxHeight: 320,
          }
        );
        popup.style.left = `${position.left}px`;
        popup.style.top = `${position.top}px`;
        popup.style.width = `${position.width}px`;
        popup.style.maxHeight = `${position.maxHeight}px`;
        popup.style.overflowY = "auto";
      };

      return {
        onStart: (props: {
          editor: Editor;
          clientRect?: (() => DOMRect | null) | null;
          items: T[];
          command: (item: { id: string; label: string }) => void;
        }) => {
          reactRenderer = new ReactRenderer(Component, {
            props: {
              items: props.items,
              command: props.command,
              emptyMessage,
            } as unknown as P,
            editor: props.editor,
          });
          popup = document.createElement("div");
          popup.className = "rich-text-mention-popup";
          popup.style.position = "fixed";
          // Must float above the task detail panel (z-60) and create modals
          // (z-100). Raised so mentions trigger inside those surfaces.
          popup.style.zIndex = "120";
          popup.appendChild(reactRenderer.element);
          document.body.appendChild(popup);
          if (props.clientRect) {
            const rect = props.clientRect();
            if (rect) placePopup(rect);
          }
        },
        onUpdate: (props: {
          items: T[];
          clientRect?: (() => DOMRect | null) | null;
          command: (item: { id: string; label: string }) => void;
        }) => {
          reactRenderer?.updateProps({
            items: props.items,
            command: props.command,
            emptyMessage,
          } as unknown as Partial<P>);
          if (props.clientRect) {
            const rect = props.clientRect();
            if (rect) placePopup(rect);
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          return reactRenderer?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
          reactRenderer?.destroy();
          reactRenderer = null;
          popup = null;
        },
      };
    },
  };
}

export interface MentionExtensionOptions {
  // URL to fetch member suggestions. Receives the typed query (after `@`).
  lookupUrl: (query: string) => string;
  emptyMessage?: string;
}

export function createMentionExtension(opts: MentionExtensionOptions) {
  const suggestion = {
    ...createSuggestionRenderer<MentionUser, MentionListHandle, MentionListProps>(
      MentionList,
      async (query) => {
        const res = await fetch(opts.lookupUrl(query));
        if (!res.ok) return [];
        const data = (await res.json()) as { members: MentionUser[] };
        return (data.members ?? []).slice(0, 8);
      },
      opts.emptyMessage
    ),
    pluginKey: new PluginKey("userMentionSuggestion"),
  };

  return Mention.configure({
    HTMLAttributes: { class: "rich-text-mention" },
    renderHTML({ options, node }) {
      const attrs = node.attrs as { id?: string; label?: string };
      const href = `user:${attrs.id ?? ""}`;
      const label = attrs.label ?? attrs.id ?? "";
      return [
        "a",
        { ...options.HTMLAttributes, href, "data-user-id": attrs.id ?? "" },
        `@${label}`,
      ];
    },
    renderText({ node }) {
      const attrs = node.attrs as { id?: string; label?: string };
      return `[@${attrs.label ?? attrs.id ?? ""}](user:${attrs.id ?? ""})`;
    },
    suggestion,
  });
}

export interface IssueMentionExtensionOptions {
  lookupUrl: (query: string) => string;
  emptyMessage?: string;
}

export function createIssueMentionExtension(opts: IssueMentionExtensionOptions) {
  const suggestion = {
    ...createSuggestionRenderer<IssueMentionItem, IssueMentionListHandle, IssueMentionListProps>(
      IssueMentionList,
      async (query) => {
        const res = await fetch(opts.lookupUrl(query));
        if (!res.ok) return [];
        const data = (await res.json()) as { items: IssueMentionItem[] };
        return (data.items ?? []).slice(0, 10);
      },
      opts.emptyMessage
    ),
    pluginKey: new PluginKey("issueMentionSuggestion"),
    char: "#",
  };

  return Mention.extend({ name: "issueMention" }).configure({
    HTMLAttributes: { class: "mention-issue" },
    renderHTML({ options, node }) {
      const attrs = node.attrs as { id?: string; label?: string };
      const href = `issue:${attrs.id ?? ""}`;
      const label = attrs.label ?? attrs.id ?? "";
      return [
        "a",
        { ...options.HTMLAttributes, href, "data-issue-id": attrs.id ?? "" },
        `#${label}`,
      ];
    },
    renderText({ node }) {
      const attrs = node.attrs as { id?: string; label?: string };
      return `[#${attrs.label ?? attrs.id ?? ""}](issue:${attrs.id ?? ""})`;
    },
    suggestion,
  });
}

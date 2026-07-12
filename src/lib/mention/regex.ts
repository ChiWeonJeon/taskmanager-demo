// Canonical mention syntax produced by the rich-text editor.
// Example: `[@Alice](user:cuid_abc)`. The User.id is the source of truth.
export const BODY_MENTION_ID_REGEX = /\[@[^\]]*\]\(user:([A-Za-z0-9_-]+)\)/g;

// Issue mention — `[#TASK-42](issue:WORKITEM_ID)` (v0.25.0+).
export const BODY_MENTION_ISSUE_REGEX = /\[#[^\]]*\]\(issue:([A-Za-z0-9_-]+)\)/g;

// Legacy textarea mention syntax.
// Example: `@alice` where the handle matches the email local-part or part of the name.
export const LEGACY_HANDLE_REGEX_G = /@([A-Za-z0-9._+-]{1,64})/g;

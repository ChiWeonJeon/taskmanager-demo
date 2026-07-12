import { prisma } from "@/lib/db";
import { scopedWorkItemWhere } from "@/lib/work-item-query";
import { extractBodyMentionRefs, type MentionRefType } from "./extract";

export interface ResolvedIssueRef {
  id: string;
  issueKey: string;
  title: string;
  projectKey: string;
  isDeleted: boolean;
}

export interface ResolvedUserRef {
  id: string;
  name: string;
  email: string;
  shortName?: string | null;
  avatarUpdatedAt?: Date | string | null;
}

export interface ResolvedMentionRefs {
  users: Record<string, ResolvedUserRef>;
  issues: Record<string, ResolvedIssueRef>;
}

// Batch-fetch display metadata for every mention in a markdown body. Used by
// server components that render RichText content — the renderer itself only
// knows the bare ID, so projectKey / issueKey / slug must be resolved server
// side in a single roundtrip before hydration.
export async function resolveMentionRefsForRender(markdown: string): Promise<ResolvedMentionRefs> {
  const refs = extractBodyMentionRefs(markdown);
  const empty: ResolvedMentionRefs = { users: {}, issues: {} };
  if (refs.length === 0) return empty;

  const idsByType: Record<MentionRefType, string[]> = { user: [], issue: [] };
  for (const ref of refs) idsByType[ref.type].push(ref.id);

  const [users, issues] = await Promise.all([
    idsByType.user.length
      ? prisma.user.findMany({
          where: { id: { in: idsByType.user } },
          select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true },
        })
      : [],
    idsByType.issue.length
      ? prisma.workItem.findMany({
          where: scopedWorkItemWhere({ id: { in: idsByType.issue } }),
          select: {
            id: true,
            issueKey: true,
            title: true,
            deletedAt: true,
            project: { select: { key: true } },
          },
        })
      : [],
  ]);

  const out: ResolvedMentionRefs = { users: {}, issues: {} };
  for (const u of users) out.users[u.id] = u;
  for (const w of issues) {
    out.issues[w.id] = {
      id: w.id,
      issueKey: w.issueKey,
      title: w.title,
      projectKey: w.project?.key ?? "",
      isDeleted: w.deletedAt !== null,
    };
  }
  return out;
}

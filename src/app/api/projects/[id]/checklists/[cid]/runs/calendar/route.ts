import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

/**
 * Returns counts of runs grouped by local date (YYYY-MM-DD) within [from, to].
 * Used by the history calendar to render dot indicators.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  const runs = await prisma.checklistRun.findMany({
    where: {
      checklistId: cid,
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    select: { startedAt: true, status: true },
    orderBy: { startedAt: "asc" },
  });

  const counts = new Map<string, { total: number; completed: number; canceled: number; running: number }>();
  for (const r of runs) {
    const d = r.startedAt;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cell = counts.get(ymd) ?? { total: 0, completed: 0, canceled: 0, running: 0 };
    cell.total += 1;
    if (r.status === "COMPLETED") cell.completed += 1;
    else if (r.status === "CANCELED") cell.canceled += 1;
    else cell.running += 1;
    counts.set(ymd, cell);
  }

  const days = Array.from(counts.entries()).map(([date, c]) => ({ date, ...c }));
  return NextResponse.json({ days });
}

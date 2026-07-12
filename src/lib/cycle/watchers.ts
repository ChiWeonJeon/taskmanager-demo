import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { WatcherSource } from "@/lib/notifications/types";

type Tx = typeof prisma | Prisma.TransactionClient;

export async function addCycleWatcherIfMissing(
  tx: Tx,
  args: { cycleId: string; userId: string; source: WatcherSource; addedById?: string | null },
): Promise<void> {
  if (!args.userId) return;
  await tx.cycleWatcher.upsert({
    where: { cycleId_userId: { cycleId: args.cycleId, userId: args.userId } },
    update: {},
    create: {
      cycleId: args.cycleId,
      userId: args.userId,
      source: args.source,
      addedById: args.addedById ?? null,
    },
  });
}

export async function getCycleWatcherIds(tx: Tx, cycleId: string): Promise<string[]> {
  const rows = await tx.cycleWatcher.findMany({
    where: { cycleId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

import "server-only";

import { createHmac } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  isServerAnalyticsEnabled,
  sanitizeServerEventProperties,
  type ServerAnalyticsEventName,
  type ServerAnalyticsEventProperties,
} from "@/lib/server-analytics-core";

type AnalyticsTransaction = Prisma.TransactionClient;

export function serverAnalyticsCollectionEnabled(): boolean {
  return isServerAnalyticsEnabled({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    enabled: process.env.SERVER_ANALYTICS_ENABLED,
    demoMode: process.env.DEMO_MODE,
    demoReadOnly: process.env.DEMO_READ_ONLY,
    identitySalt: process.env.SERVER_ANALYTICS_ID_SALT,
  });
}

function anonymousServerActorId(actorId: string): string | null {
  const salt = process.env.SERVER_ANALYTICS_ID_SALT?.trim();
  if (!salt || !actorId) return null;
  return `server-${createHmac("sha256", salt).update(actorId).digest("hex").slice(0, 24)}`;
}

export async function enqueueServerAnalyticsEvent<Event extends ServerAnalyticsEventName>(
  client: AnalyticsTransaction | typeof prisma,
  event: Event,
  actorId: string,
  properties: ServerAnalyticsEventProperties[Event],
): Promise<boolean> {
  if (!serverAnalyticsCollectionEnabled()) return false;
  const distinctId = anonymousServerActorId(actorId);
  if (!distinctId) return false;

  await client.serverAnalyticsEvent.create({
    data: {
      eventName: event,
      distinctId,
      properties: JSON.stringify(sanitizeServerEventProperties(event, properties)),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "unknown",
      environment: "production",
      deliveries: {
        create: [
          { destination: "MIXPANEL" },
          { destination: "DISCORD" },
        ],
      },
    },
  });
  return true;
}

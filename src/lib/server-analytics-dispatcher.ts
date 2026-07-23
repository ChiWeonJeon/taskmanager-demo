import "server-only";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { isRetryableDeliveryStatus, nextDeliveryDelayMs } from "@/lib/server-analytics-core";
import { serverAnalyticsCollectionEnabled } from "@/lib/server-analytics";

const DELIVERY_BATCH_SIZE = 25;
const DELIVERY_LEASE_MS = 60_000;
const MAX_DELIVERY_ATTEMPTS = 10;

interface DeliveryResult {
  ok: boolean;
  status: number;
  externalId?: string;
  retryAfterMs?: number;
}

interface QueuedDelivery {
  id: string;
  destination: string;
  attempts: number;
  event: {
    id: string;
    eventName: string;
    distinctId: string;
    properties: string;
    appVersion: string;
    environment: string;
    occurredAt: Date;
  };
}

function mixpanelConfigured(): boolean {
  return process.env.SERVER_ANALYTICS_ENABLED === "true"
    && Boolean(process.env.MIXPANEL_SERVER_PROJECT_ID?.trim())
    && Boolean(process.env.MIXPANEL_SERVER_USERNAME?.trim())
    && Boolean(process.env.MIXPANEL_SERVER_SECRET?.trim());
}

function discordWebhookUrl(): URL | null {
  const value = process.env.DISCORD_SERVER_EVENT_WEBHOOK_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const validHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
    const validPath = /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(url.pathname);
    return url.protocol === "https:" && validHost && validPath ? url : null;
  } catch {
    return null;
  }
}

function discordConfigured(): boolean {
  return process.env.SERVER_EVENT_NOTIFICATIONS_ENABLED === "true" && Boolean(discordWebhookUrl());
}

function parseProperties(value: string): Record<string, string | number | boolean> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, property]) =>
      typeof property === "string" || typeof property === "number" || typeof property === "boolean"
    )) as Record<string, string | number | boolean>;
  } catch {
    return {};
  }
}

async function sendToMixpanel(delivery: QueuedDelivery): Promise<DeliveryResult> {
  const projectId = process.env.MIXPANEL_SERVER_PROJECT_ID!.trim();
  const username = process.env.MIXPANEL_SERVER_USERNAME!.trim();
  const secret = process.env.MIXPANEL_SERVER_SECRET!.trim();
  const authorization = Buffer.from(`${username}:${secret}`).toString("base64");
  const url = new URL("https://api.mixpanel.com/import");
  url.searchParams.set("strict", "1");
  url.searchParams.set("project_id", projectId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{
      event: delivery.event.eventName,
      properties: {
        ...parseProperties(delivery.event.properties),
        app_version: delivery.event.appVersion,
        environment: delivery.event.environment,
        source: "server",
        time: delivery.event.occurredAt.getTime(),
        distinct_id: delivery.event.distinctId,
        $insert_id: delivery.event.id,
        ip: 0,
      },
    }]),
    signal: AbortSignal.timeout(5_000),
  });

  return {
    ok: response.ok,
    status: response.status,
    retryAfterMs: retryAfterMs(response),
  };
}

async function sendToDiscord(delivery: QueuedDelivery): Promise<DeliveryResult> {
  const url = discordWebhookUrl();
  if (!url) return { ok: false, status: 400 };
  url.searchParams.set("wait", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: delivery.event.eventName,
        color: 0x5865f2,
        fields: [
          { name: "event_id", value: delivery.event.id, inline: false },
          { name: "occurred_at", value: delivery.event.occurredAt.toISOString(), inline: true },
          { name: "environment", value: delivery.event.environment, inline: true },
          { name: "app_version", value: delivery.event.appVersion, inline: true },
        ],
      }],
    }),
    signal: AbortSignal.timeout(5_000),
  });

  let externalId: string | undefined;
  if (response.ok) {
    try {
      const body = await response.json() as { id?: unknown };
      if (typeof body.id === "string") externalId = body.id.slice(0, 120);
    } catch {
      // A successful webhook may return no body; delivery is still complete.
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    externalId,
    retryAfterMs: retryAfterMs(response),
  };
}

function retryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1_000) : undefined;
}

async function releaseUnconfiguredDelivery(id: string): Promise<void> {
  await prisma.serverAnalyticsDelivery.update({
    where: { id },
    data: {
      leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + 5 * 60_000),
      lastError: "destination_not_configured",
    },
  });
}

async function deliver(delivery: QueuedDelivery): Promise<"delivered" | "retry" | "failed" | "skipped"> {
  if (delivery.destination === "MIXPANEL" && !mixpanelConfigured()) {
    await releaseUnconfiguredDelivery(delivery.id);
    return "skipped";
  }
  if (delivery.destination === "DISCORD" && !discordConfigured()) {
    await releaseUnconfiguredDelivery(delivery.id);
    return "skipped";
  }

  let result: DeliveryResult;
  try {
    if (delivery.destination === "MIXPANEL") result = await sendToMixpanel(delivery);
    else if (delivery.destination === "DISCORD") result = await sendToDiscord(delivery);
    else result = { ok: false, status: 400 };
  } catch {
    result = { ok: false, status: 0 };
  }

  if (result.ok) {
    await prisma.serverAnalyticsDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        attempts: { increment: 1 },
        leaseUntil: null,
        deliveredAt: new Date(),
        externalId: result.externalId ?? null,
        lastError: null,
      },
    });
    return "delivered";
  }

  const nextAttempt = delivery.attempts + 1;
  const retryable = result.status === 0 || isRetryableDeliveryStatus(result.status);
  const shouldRetry = retryable && nextAttempt < MAX_DELIVERY_ATTEMPTS;
  const delay = result.retryAfterMs ?? nextDeliveryDelayMs(nextAttempt);
  await prisma.serverAnalyticsDelivery.update({
    where: { id: delivery.id },
    data: {
      status: shouldRetry ? "PENDING" : "FAILED",
      attempts: { increment: 1 },
      leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + delay),
      lastError: result.status ? `http_${result.status}` : "network_error",
    },
  });
  return shouldRetry ? "retry" : "failed";
}

export async function dispatchServerAnalyticsDeliveries(limit = DELIVERY_BATCH_SIZE) {
  if (!serverAnalyticsCollectionEnabled()) {
    return { delivered: 0, retry: 0, failed: 0, skipped: 0 };
  }
  const now = new Date();
  const candidates = await prisma.serverAnalyticsDelivery.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  const summary = { delivered: 0, retry: 0, failed: 0, skipped: 0 };
  for (const candidate of candidates) {
    const leased = await prisma.serverAnalyticsDelivery.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseUntil: new Date(Date.now() + DELIVERY_LEASE_MS) },
    });
    if (leased.count !== 1) continue;

    const delivery = await prisma.serverAnalyticsDelivery.findUnique({
      where: { id: candidate.id },
      include: { event: true },
    });
    if (!delivery) continue;
    const result = await deliver(delivery);
    summary[result] += 1;
  }
  return summary;
}

export function scheduleServerAnalyticsDispatch(): void {
  after(async () => {
    try {
      await dispatchServerAnalyticsDeliveries();
    } catch {
      console.error("[server-analytics] background dispatcher failed");
    }
  });
}

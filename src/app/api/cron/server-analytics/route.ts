import { NextRequest, NextResponse } from "next/server";
import { dispatchServerAnalyticsDeliveries } from "@/lib/server-analytics-dispatcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const summary = await dispatchServerAnalyticsDeliveries();
  return NextResponse.json({ ok: true, ...summary });
}

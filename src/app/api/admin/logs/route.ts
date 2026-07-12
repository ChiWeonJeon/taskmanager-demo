import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getApiLogs, clearApiLogs } from "@/lib/api-logger";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  return NextResponse.json(getApiLogs());
}

export async function DELETE() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  clearApiLogs();
  return new NextResponse(null, { status: 204 });
}

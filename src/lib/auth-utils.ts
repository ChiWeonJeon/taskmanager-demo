import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!isAdminUser(session.user)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminUser(user?: { role?: string | null; email?: string | null }): boolean {
  if (!user) return false;
  return user.role === "ADMIN";
}

export const DEMO_USER_ID = "demo-viewer-aetherfall";
export const DEMO_USER_EMAIL = "viewer@aetherfall.example";

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function isDemoReadOnly() {
  return isDemoMode() && process.env.DEMO_READ_ONLY === "true";
}

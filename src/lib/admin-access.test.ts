import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAdminUser, normalizeEmail } from "@/lib/admin-access";

describe("admin access", () => {
  it("normalizes email for identity lookup only", () => {
    assert.equal(normalizeEmail("  Viewer@AETHERFALL.EXAMPLE "), "viewer@aetherfall.example");
    assert.equal(normalizeEmail(null), "");
  });

  it("grants admin access only from the local DB role", () => {
    assert.equal(isAdminUser({ email: "viewer@aetherfall.example", role: "USER" }), false);
    assert.equal(isAdminUser({ email: "admin@example.com", role: "ADMIN" }), true);
    assert.equal(isAdminUser({ email: "admin@example.com", role: null }), false);
  });
});

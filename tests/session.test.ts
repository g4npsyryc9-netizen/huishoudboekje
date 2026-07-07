import { describe, it, expect, beforeEach } from "vitest";
import { createSessionCookie, verifySessionCookie } from "@/lib/session";

describe("session cookie", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-value-not-for-production";
  });

  it("creates a token that verifies as valid", async () => {
    const token = await createSessionCookie();
    expect(await verifySessionCookie(token)).toBe(true);
  });

  it("rejects a garbage token", async () => {
    expect(await verifySessionCookie("not-a-real-token")).toBe(false);
  });
});

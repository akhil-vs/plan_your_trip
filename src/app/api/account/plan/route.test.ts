import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

vi.mock("@/lib/api-auth", () => ({
  getApiUser: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdminEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

import { getApiUser } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

describe("PUT /api/account/plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin self-serve plan changes", async () => {
    vi.mocked(getApiUser).mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      name: "User",
      plan: "FREE",
    });
    vi.mocked(isAdminEmail).mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/account/plan", {
      method: "PUT",
      body: JSON.stringify({ plan: "PRO" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("allows admin plan override", async () => {
    vi.mocked(getApiUser).mockResolvedValue({
      id: "admin1",
      email: "admin@example.com",
      name: "Admin",
      plan: "PRO",
    });
    vi.mocked(isAdminEmail).mockReturnValue(true);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "u2",
      email: "other@example.com",
      name: "Other",
      plan: "PRO",
    });

    const req = new NextRequest("http://localhost/api/account/plan", {
      method: "PUT",
      body: JSON.stringify({ plan: "PRO", userId: "u2" }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: { plan: "PRO" },
      })
    );
  });
});

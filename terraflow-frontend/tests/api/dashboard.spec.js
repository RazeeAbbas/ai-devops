import { test, expect } from "@playwright/test";

test.describe("GET /api/dashboard", () => {
  test("returns 200 with complete dashboard metrics and structure", async ({ request }) => {
    const response = await request.get("/api/dashboard");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const data = await response.json();

    // Summary validation
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.totalDeployments).toBe("number");
    expect(typeof data.summary.successful).toBe("number");
    expect(typeof data.summary.failed).toBe("number");
    expect(typeof data.summary.running).toBe("number");
    expect(data.summary.successRate).toMatch(/\d+(\.\d+)?%/);
    expect(data.summary.failureRate).toMatch(/\d+(\.\d+)?%/);
    expect(data.summary.totalEstimatedMonthlyCost).toMatch(/^\$\d+(\.\d{2})?$/);

    // Deployments by type validation (Bar chart data)
    expect(Array.isArray(data.deploymentsByType)).toBe(true);
    expect(data.deploymentsByType.length).toBeGreaterThanOrEqual(5);
    const mainType = data.deploymentsByType.find((item) => item.type === "main");
    expect(mainType).toBeDefined();
    expect(mainType.count).toBeGreaterThan(0);

    // Status distribution validation (Pie chart data)
    expect(Array.isArray(data.statusDistribution)).toBe(true);
    expect(data.statusDistribution.length).toBe(3);
    const statuses = data.statusDistribution.map((s) => s.status);
    expect(statuses).toContain("Successful");
    expect(statuses).toContain("Failed");
    expect(statuses).toContain("Running");

    // Workspaces cost validation
    expect(Array.isArray(data.workspacesCost)).toBe(true);
    for (const item of data.workspacesCost) {
      expect(typeof item.workspace).toBe("string");
      expect(typeof item.hasState).toBe("boolean");
      expect(typeof item.computeCost).toBe("number");
      expect(typeof item.storageCost).toBe("number");
      expect(typeof item.ipCost).toBe("number");
      expect(typeof item.monthlyTotal).toBe("number");
      expect(item.monthlyTotal).toBeGreaterThan(0);
    }
  });
});

test.describe("POST /api/redeploy input validation", () => {
  test("rejects missing workspace with 400", async ({ request }) => {
    const response = await request.post("/api/redeploy", { data: {} });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("workspace is required for redeployment");
  });

  test("rejects workspace with illegal characters", async ({ request }) => {
    const response = await request.post("/api/redeploy", {
      data: { workspace: "invalid workspace!" }
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("may contain only letters");
  });
});


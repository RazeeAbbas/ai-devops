import { test, expect } from "@playwright/test";

const VALID_PAYLOAD = {
  resourceGroupName: "qa-smoke",
  vmName: "qa-smoke",
  dnsName: "qasmoke",
  environment: "dev",
  location: "UK South",
  vmSize: "Standard_B2als_v2",
  adminUsername: "azureadmin"
};

const REQUIRED_FIELDS = [
  "resourceGroupName",
  "vmName",
  "dnsName",
  "environment",
  "location",
  "vmSize",
  "adminUsername"
];

test.describe("POST /api/deploy input validation", () => {
  test("rejects an empty body", async ({ request }) => {
    const response = await request.post("/api/deploy", { data: {} });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("resourceGroupName is required");
  });

  for (const field of REQUIRED_FIELDS) {
    test(`rejects a payload with a blank ${field}`, async ({ request }) => {
      const response = await request.post("/api/deploy", {
        data: { ...VALID_PAYLOAD, [field]: "   " }
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe(`${field} is required`);
    });
  }

  test("rejects a resource group name with illegal characters", async ({ request }) => {
    const response = await request.post("/api/deploy", {
      data: { ...VALID_PAYLOAD, resourceGroupName: "bad name!" }
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("may contain only letters");
  });

  test("rejects a malformed JSON body with a JSON error", async ({ request }) => {
    const response = await request.post("/api/deploy", {
      headers: { "Content-Type": "application/json" },
      data: "{ this is not json"
    });

    expect(response.headers()["content-type"]).toContain("application/json");
    expect(typeof (await response.json()).error).toBe("string");
  });
});

test.describe("POST /api/deploy plan run", () => {
  test("runs a Terraform plan and always answers with JSON", async ({ request }) => {
    test.setTimeout(180_000);

    const response = await request.post("/api/deploy", { data: VALID_PAYLOAD });

    expect(response.headers()["content-type"]).toContain("application/json");

    const body = await response.json();
    expect(typeof body.output === "string" || typeof body.error === "string").toBe(true);

    if (body.error === undefined) {
      expect(body.workspace).toBe(VALID_PAYLOAD.resourceGroupName);
      expect(typeof body.success).toBe("boolean");
      expect(body.jobId).toMatch(/^terraform-/);
      expect(body.output.length).toBeGreaterThan(0);
    }
  });

  test("exposes the run through GET /api/jobs", async ({ request }) => {
    test.setTimeout(180_000);

    const workspace = "qa-jobs-check";
    await request.post("/api/deploy", { data: { ...VALID_PAYLOAD, resourceGroupName: workspace } });

    const jobs = await (await request.get("/api/jobs")).json();
    const job = jobs.find((entry) => entry.workspace === workspace);

    expect(job).toBeDefined();
    expect(job.stateFile).toBe(`terraform.tfstate.d/${workspace}/terraform.tfstate`);
    expect(["running", "completed", "failed"]).toContain(job.status);
    expect(Number.isNaN(Date.parse(job.started))).toBe(false);
    expect(Number.isNaN(Date.parse(job.updated))).toBe(false);
  });
});

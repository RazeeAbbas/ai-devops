import { test, expect } from "@playwright/test";

test.describe("GET /api/jobs", () => {
  test("returns a JSON array", async ({ request }) => {
    const response = await request.get("/api/jobs");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(Array.isArray(await response.json())).toBe(true);
  });
});

test.describe("unknown API routes", () => {
  test("respond with JSON instead of the static HTML 404 body", async ({ request }) => {
    const response = await request.get("/api/does-not-exist");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");

    const body = await response.json();
    expect(body.error).toContain("/api/does-not-exist");
  });

  test("reject an unsupported method on a known route with JSON", async ({ request }) => {
    const response = await request.post("/api/jobs");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");

    const body = await response.json();
    expect(body.error).toContain("POST /api/jobs");
  });
});

test.describe("static assets", () => {
  const pages = ["/", "/deploy.html", "/jobs.html", "/statefiles.html", "/styles.css", "/app.js", "/api.js", "/dashboard.js"];

  for (const page of pages) {
    test(`${page} is served`, async ({ request }) => {
      const response = await request.get(page);
      expect(response.status()).toBe(200);
    });
  }

  test("a missing page still returns a plain 404", async ({ request }) => {
    const response = await request.get("/missing-page.html");
    expect(response.status()).toBe(404);
  });
});

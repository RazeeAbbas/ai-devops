import { test, expect } from "@playwright/test";

const COMPLETED_JOB = {
  id: "terraform-1",
  workspace: "qa-smoke",
  action: "Terraform Plan (Dry Run)",
  status: "completed",
  started: "2026-09-21T05:00:00.000Z",
  updated: "2026-09-21T05:00:05.000Z",
  output: "Plan: 3 to add, 0 to change, 0 to destroy.",
  stateFile: "terraform.tfstate.d/qa-smoke/terraform.tfstate"
};

function fulfillJobs(route, jobs) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(jobs)
  });
}

test.describe("jobs page", () => {
  test("shows the empty state when no jobs exist", async ({ page }) => {
    await page.route("**/api/jobs", (route) => fulfillJobs(route, []));

    await page.goto("/jobs.html");

    await expect(page.locator("#jobs .empty-jobs")).toContainText("No Terraform jobs yet");
  });

  test("renders a job card with status, workspace, state file and log", async ({ page }) => {
    await page.route("**/api/jobs", (route) => fulfillJobs(route, [COMPLETED_JOB]));

    await page.goto("/jobs.html");

    const card = page.locator(".job-card").first();
    await expect(card.locator("h2")).toHaveText("Job ID: terraform-1");
    await expect(card.locator(".badge")).toHaveText("completed");
    await expect(card).toContainText("Workspace:");
    await expect(card).toContainText("qa-smoke");
    await expect(card).toContainText("Terraform Plan (Dry Run)");
    await expect(card.locator(".job-fields strong")).toHaveText(
      "terraform.tfstate.d/qa-smoke/terraform.tfstate"
    );
    await expect(card.locator(".job-log")).toContainText("Plan: 3 to add");
  });

  test("falls back to a placeholder when a job has no log output", async ({ page }) => {
    await page.route("**/api/jobs", (route) => fulfillJobs(route, [{ ...COMPLETED_JOB, output: "" }]));

    await page.goto("/jobs.html");

    await expect(page.locator(".job-log").first()).toHaveText("No log output yet.");
  });

  test("the \"New deployment\" button returns to the deploy page", async ({ page }) => {
    await page.route("**/api/jobs", (route) => fulfillJobs(route, [COMPLETED_JOB]));

    await page.goto("/jobs.html");
    await page.getByRole("link", { name: /new deployment/i }).click();

    await expect(page).toHaveURL((url) => url.pathname === "/deploy.html");
    await expect(page.locator("h1")).toContainText("Ship an environment");
  });

  test("reports an API error message", async ({ page }) => {
    await page.route("**/api/jobs", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" })
      })
    );

    await page.goto("/jobs.html");

    await expect(page.locator("#jobs .empty-jobs")).toContainText("HTTP 500 from /api/jobs - boom");
  });

  test("names a non-JSON response instead of reporting 'not valid JSON'", async ({ page }) => {
    await page.route("**/api/jobs", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "Not found" })
    );

    await page.goto("/jobs.html");

    await expect(page.locator("#jobs .empty-jobs")).toContainText(
      "expected JSON from /api/jobs but received - Not found"
    );
  });
});

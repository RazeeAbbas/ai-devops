import { test, expect } from "@playwright/test";

const TRACKED_WORKSPACE = {
  workspace: "workbook",
  hasState: true,
  file: "terraform.tfstate",
  relativePath: "terraform.tfstate.d/workbook/terraform.tfstate",
  size: 1753,
  updated: "2026-09-21T05:34:56.021Z",
  backupCount: 0
};

const UNTRACKED_WORKSPACE = {
  workspace: "workshop",
  hasState: false,
  file: null,
  relativePath: null,
  size: 0,
  updated: null,
  backupCount: 0
};

function fulfillWorkspaces(route, workspaces) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(workspaces)
  });
}

test.describe("statefiles page", () => {
  test("renders one card per workspace returned by the API", async ({ page }) => {
    await page.route("**/api/statefiles", (route) =>
      fulfillWorkspaces(route, [TRACKED_WORKSPACE, UNTRACKED_WORKSPACE])
    );

    await page.goto("/statefiles.html");

    await expect(page.locator(".statefile-card")).toHaveCount(2);
    await expect(page.locator(".statefile-card h2")).toHaveText(["workbook", "workshop"]);
  });

  test("shows metadata for a workspace that has a state file", async ({ page }) => {
    await page.route("**/api/statefiles", (route) => fulfillWorkspaces(route, [TRACKED_WORKSPACE]));

    await page.goto("/statefiles.html");

    const card = page.locator(".statefile-card").first();
    await expect(card.locator(".badge")).toHaveText("tracked");
    await expect(card.locator(".statefile-path")).toHaveText(
      "terraform.tfstate.d/workbook/terraform.tfstate"
    );
    await expect(card).toContainText("terraform.tfstate");
    await expect(card).toContainText("1.7 KB");
    await expect(card).toContainText("Backups");
  });

  test("marks a workspace with no state file as pending", async ({ page }) => {
    await page.route("**/api/statefiles", (route) => fulfillWorkspaces(route, [UNTRACKED_WORKSPACE]));

    await page.goto("/statefiles.html");

    const card = page.locator(".statefile-card").first();
    await expect(card.locator(".badge")).toHaveText("no state yet");
    await expect(card).toContainText("not created yet");
  });

  test("shows the empty state when no workspaces exist", async ({ page }) => {
    await page.route("**/api/statefiles", (route) => fulfillWorkspaces(route, []));

    await page.goto("/statefiles.html");

    await expect(page.locator("#statefiles .empty-jobs")).toContainText(
      "No Terraform workspaces found yet"
    );
  });

  test("names a non-JSON response instead of reporting 'not valid JSON'", async ({ page }) => {
    await page.route("**/api/statefiles", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "Not found" })
    );

    await page.goto("/statefiles.html");

    await expect(page.locator("#statefiles .empty-jobs")).toContainText(
      "expected JSON from /api/statefiles but received - Not found"
    );
  });

  test("renders every real workspace from the live backend", async ({ page, request }) => {
    const workspaces = await (await request.get("/api/statefiles")).json();

    await page.goto("/statefiles.html");

    await expect(page.locator(".statefile-card")).toHaveCount(workspaces.length);
    for (const { workspace } of workspaces) {
      await expect(page.locator(`.statefile-card[data-workspace="${workspace}"]`)).toBeVisible();
    }
  });
});

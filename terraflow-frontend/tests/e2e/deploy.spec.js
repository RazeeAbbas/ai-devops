import { test, expect } from "@playwright/test";

const TEXT_FIELDS = [
  { name: "resourceGroupName", value: "workbook" },
  { name: "vmName", value: "workbook" },
  { name: "dnsName", value: "test" },
  { name: "adminUsername", value: "azureadmin" }
];

test.describe("deployment form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/deploy.html");
  });

  test("renders every field with its default value", async ({ page }) => {
    for (const { name, value } of TEXT_FIELDS) {
      await expect(page.locator(`[name="${name}"]`)).toHaveValue(value);
    }

    await expect(page.locator('[name="environment"]')).toHaveValue("dev");
    await expect(page.locator('[name="location"]')).toHaveValue("UK South");
    await expect(page.locator('[name="vmSize"]')).toHaveValue("Standard_B2als_v2");
    await expect(page.locator('[name="vmCategory"]')).toBeVisible();
  });

  test("shows an enabled, labelled submit button", async ({ page }) => {
    const button = page.getByRole("button", { name: /preview plan/i });

    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("updates the workspace and FQDN previews while typing", async ({ page }) => {
    await expect(page.locator("#workspace-name")).toHaveText("workbook");
    await expect(page.locator("#fqdn-preview")).toHaveText("test.workshop.local");

    await page.locator('[name="resourceGroupName"]').fill("qa-preview");
    await page.locator('[name="dnsName"]').fill("qahost");

    await expect(page.locator("#workspace-name")).toHaveText("qa-preview");
    await expect(page.locator("#fqdn-preview")).toHaveText("qahost.workshop.local");
  });

  test("falls back to placeholder previews when fields are cleared", async ({ page }) => {
    await page.locator('[name="resourceGroupName"]').fill("");
    await page.locator('[name="dnsName"]').fill("");

    await expect(page.locator("#workspace-name")).toHaveText("workspace-name");
    await expect(page.locator("#fqdn-preview")).toHaveText("hostname.workshop.local");
  });

  test("blocks submission when a required field is empty", async ({ page }) => {
    await page.locator('[name="vmName"]').fill("");
    await page.getByRole("button", { name: /preview plan/i }).click();

    await expect(page.locator("#run-state")).toHaveText("waiting");
    await expect(page.locator("#output")).toContainText("Your plan output will appear here");
  });

  test("posts the form values and renders the plan output", async ({ page }) => {
    let payload = null;
    await page.route("**/api/deploy", async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspace: "qa-ui",
          success: true,
          jobId: "terraform-test",
          output: "Terraform will perform the following actions"
        })
      });
    });

    await page.locator('[name="resourceGroupName"]').fill("qa-ui");
    await page.locator('[name="dnsName"]').fill("qaui");
    await page.getByRole("button", { name: /preview plan/i }).click();

    await expect(page.locator("#run-state")).toHaveText("workspace: qa-ui");
    await expect(page.locator("#output")).toContainText("Terraform will perform the following actions");

    expect(payload).toMatchObject({
      resourceGroupName: "qa-ui",
      dnsName: "qaui",
      environment: "dev",
      location: "UK South",
      vmSize: "Standard_B2als_v2",
      adminUsername: "azureadmin"
    });
  });

  test("shows the running state while the request is in flight", async ({ page }) => {
    await page.route("**/api/deploy", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workspace: "slow", success: true, jobId: "t", output: "done" })
      });
    });

    await page.getByRole("button", { name: /preview plan/i }).click();

    await expect(page.locator("#run-state")).toHaveText("running");
    await expect(page.locator("#run-state")).toHaveClass(/running/);
  });

  test("surfaces a backend validation error and marks the run failed", async ({ page }) => {
    await page.route("**/api/deploy", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "vmName is required" })
      })
    );

    await page.getByRole("button", { name: /preview plan/i }).click();

    await expect(page.locator("#output")).toHaveText("vmName is required");
    await expect(page.locator("#run-state")).toHaveText("failed");
    await expect(page.locator("#run-state")).toHaveClass(/error/);
  });

  test("surfaces a network failure without a JSON parse error", async ({ page }) => {
    await page.route("**/api/deploy", (route) => route.abort());

    await page.getByRole("button", { name: /preview plan/i }).click();

    await expect(page.locator("#run-state")).toHaveText("offline");
    await expect(page.locator("#output")).toContainText("cannot reach the local runner");
  });
});

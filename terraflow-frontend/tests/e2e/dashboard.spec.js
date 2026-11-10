import { test, expect } from "@playwright/test";

test.describe("dashboard landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the header title and description", async ({ page }) => {
    await expect(page.locator("h1.dashboard-title")).toHaveText("Terraflow Dashboard");
    await expect(page.locator(".dashboard-subtitle")).toContainText("Deploy and manage your infrastructure with confidence");
  });

  test("renders all four KPI metric cards with expected baseline figures", async ({ page }) => {
    await expect(page.locator("#kpi-total")).toBeVisible();
    await expect(page.locator("#kpi-total")).toHaveText(/\d+/);

    await expect(page.locator("#kpi-success")).toBeVisible();
    await expect(page.locator("#kpi-success")).toHaveText(/\d+/);
    await expect(page.locator("#kpi-success-rate")).toContainText("% success rate");

    await expect(page.locator("#kpi-failed")).toBeVisible();
    await expect(page.locator("#kpi-failed")).toHaveText(/\d+/);
    await expect(page.locator("#kpi-failure-rate")).toContainText("% failure rate");

    await expect(page.locator("#kpi-running")).toBeVisible();
    await expect(page.locator("#kpi-running")).toHaveText(/\d+/);
  });

  test("renders both SVG charts for deployments by type and job status distribution", async ({ page }) => {
    // Bar chart
    const barChart = page.locator("#bar-chart-container svg");
    await expect(barChart).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deployments by Type" })).toBeVisible();
    await expect(barChart.locator(".chart-bar")).toHaveCount(5);

    // Pie chart
    const pieChart = page.locator("#pie-chart-container svg");
    await expect(pieChart).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job Status Distribution" })).toBeVisible();
    await expect(pieChart.locator(".chart-slice")).toHaveCount(3);
  });

  test("renders the cost estimation table with cloud spend breakdown", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Cost Estimation" })).toBeVisible();
    await expect(page.locator(".total-cost-badge strong")).toContainText("$");

    const costRows = page.locator("#cost-table-body tr");
    await expect(costRows.first()).toBeVisible();
    await expect(page.locator("#cost-table-body")).toContainText("Standard_B2als_v2");
  });

  test("renders the redeployment hub and supports navigation to new deployment", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Redeployment Hub" })).toBeVisible();

    const redeployItems = page.locator(".redeploy-item");
    await expect(redeployItems.first()).toBeVisible();

    const redeployButtons = page.locator(".redeploy-button");
    await expect(redeployButtons.first()).toBeVisible();

    // Test + New button navigates to /deploy.html
    await page.locator(".new-deploy-btn").click();
    await expect(page).toHaveURL((url) => url.pathname === "/deploy.html");
    await expect(page.locator("h1")).toContainText("Ship an environment");
  });
});


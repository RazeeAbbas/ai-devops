import { test, expect } from "@playwright/test";

const PAGES = [
  { pathname: "/", navLabel: "Dashboard", heading: "Terraflow Dashboard" },
  { pathname: "/deploy.html", navLabel: "Deploy", heading: "Ship an environment" },
  { pathname: "/jobs.html", navLabel: "Jobs", heading: "Job status" },
  { pathname: "/statefiles.html", navLabel: "Statefiles", heading: "Statefiles" }
];

test.describe("page shell", () => {
  for (const { pathname, navLabel, heading } of PAGES) {
    test(`${pathname} renders the top bar, heading and active nav item`, async ({ page }) => {
      await page.goto(pathname);

      await expect(page.locator("h1")).toContainText(heading);
      await expect(page.locator(".brand")).toBeVisible();
      await expect(page.locator(".status-dot")).toBeVisible();
      await expect(page.locator(".status")).toContainText("local runner ready");
      await expect(page.locator(".main-nav a.active")).toHaveText(navLabel);
    });

    test(`${pathname} loads without uncaught JavaScript errors`, async ({ page }) => {
      const failures = [];
      page.on("pageerror", (error) => failures.push(error.message));

      await page.goto(pathname);
      await page.waitForLoadState("networkidle");

      expect(failures).toEqual([]);
    });
  }
});

test.describe("primary navigation buttons", () => {
  for (const { pathname, navLabel } of PAGES) {
    test(`clicking "${navLabel}" navigates and highlights the tab`, async ({ page }) => {
      await page.goto("/");
      await page.locator(".main-nav").getByRole("link", { name: navLabel, exact: true }).click();

      await expect(page).toHaveURL((url) => url.pathname === pathname);
      await expect(page.locator(".main-nav a.active")).toHaveText(navLabel);
    });
  }
});

test.describe("brand button", () => {
  const secondary = PAGES.filter((page) => page.pathname !== "/");

  for (const { pathname } of secondary) {
    test(`returns to the dashboard from ${pathname}`, async ({ page }) => {
      await page.goto(pathname);
      await page.locator(".brand").click();

      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expect(page.locator("h1")).toContainText("Terraflow Dashboard");
    });
  }
});

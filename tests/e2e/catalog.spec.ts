import { expect, test } from "@playwright/test";

test("shows the catalog on the home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("SimuPhys — Interactive physics laboratory");
  await expect(
    page.getByRole("heading", { name: "Choose your experiment." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free fall" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Free fall/ }),
  ).toHaveAttribute("href", "/simulations/free-fall");
});

test("filters simulations and clears the search", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");

  const search = page.getByRole("searchbox", {
    name: "Search simulations",
  });
  await search.fill("orbit");
  await expect(
    page.getByRole("heading", { name: "Three-body problem" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Orbital motion" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Free fall" })).toBeHidden();

  await search.fill("thermodynamics");
  await expect(page.getByText("No experiments found")).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByRole("heading", { name: "Free fall" })).toBeVisible();
});

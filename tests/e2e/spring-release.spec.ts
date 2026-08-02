import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
}

test("ouvre l’expérience depuis le catalogue", async ({ page }) => {
  await page.goto("/");

  const experiment = page.getByRole("link", { name: /Spring release/ });
  await expect(experiment).toHaveAttribute("href", "/simulations/spring-release");
  await experiment.click();
  await expect(
    page.getByRole("heading", { name: "Qui touche le sol en premier ?" }),
  ).toBeVisible();
});

test("coupe les attaches et propage l’onde dans le ressort", async ({ page }) => {
  await page.goto("/simulations/spring-release");
  await waitForHydration(page);

  const canvas = page.locator(
    'canvas[aria-label^="Animation comparative d’une balle sous une corde"]',
  );
  await expect(canvas).toHaveAttribute("data-wave-state", "ready");

  await page.getByRole("button", { name: "Couper les deux attaches" }).click();
  await expect(page.getByText("Onde en propagation")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-wave-state", "travelling");

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();
});

test("recalcule le verdict quand les paramètres changent", async ({ page }) => {
  await page.goto("/simulations/spring-release");
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", {
      name: "La balle côté corde touche le sol en premier.",
    }),
  ).toBeVisible();

  await page.getByRole("slider", { name: "Masse de la balle" }).fill("1");
  await page.getByRole("slider", { name: "Masse du ressort" }).fill("1.2");
  await page.getByRole("slider", { name: "Raideur du ressort" }).fill("3");
  await page.getByRole("slider", { name: "Gravité" }).fill("1.6");

  await expect(
    page.getByRole("heading", {
      name: "La balle côté ressort rattrape son retard et gagne.",
    }),
  ).toBeVisible();
});

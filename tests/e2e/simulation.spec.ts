import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
}

test("lance, met en pause et réinitialise l'expérience", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await expect(
    page.getByRole("heading", { name: "Deux balles. Une seule gravité." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Lancer l’expérience" }).click();
  await expect(page.getByText("En mouvement")).toBeVisible();
  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause")).toBeVisible();

  await page
    .getByRole("button", { name: "Réinitialiser l’expérience" })
    .click();
  await expect(page.getByText("t = 0,00 s")).toBeVisible();
});

test("modifie un paramètre et applique le préréglage Terre", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const gravity = page.getByRole("slider", { name: "Gravité" });
  await gravity.fill("3.7");
  await expect(gravity).toHaveValue("3.7");
  await page.getByRole("button", { name: /Préréglage Terre/ }).click();
  await expect(gravity).toHaveValue("9.81");
});

test("compare la chute avec l'air et dans le vide", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const airResistance = page.getByRole("checkbox", {
    name: "Résistance de l’air",
  });

  await expect(airResistance).toBeChecked();
  const impactReadout = page.locator(".metric-card").first();
  await expect(impactReadout.getByText("LÂCHÉE")).toBeVisible();
  await expect(impactReadout.getByText("LANCÉE")).toBeVisible();
  await expect(page.getByText(/Écart entre les impacts/)).toBeVisible();

  await airResistance.uncheck();
  await expect(page.getByText("Impact simultané dans le vide")).toBeVisible();
  await expect(page.getByText("MODÈLE : VIDE PARFAIT")).toBeVisible();
});

test("réduit les éléments illustratifs quand la portée augmente", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const canvas = page.locator(
    'canvas[aria-label="Animation des deux balles en chute libre"]',
  );
  const initialZoom = Number(await canvas.getAttribute("data-camera-zoom"));

  await page
    .getByRole("slider", { name: "Hauteur de départ" })
    .fill("100");

  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-zoom")))
    .toBeGreaterThan(initialZoom);
});

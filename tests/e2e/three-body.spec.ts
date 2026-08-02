import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("main")).toHaveAttribute("data-hydrated", "true");
}

test("ouvre le laboratoire gravitationnel depuis le catalogue", async ({ page }) => {
  await page.goto("/");

  const experiment = page.getByRole("link", { name: /Three-body problem/ });
  await expect(experiment).toHaveAttribute("href", "/simulations/three-body");
  await experiment.click();
  await expect(
    page.getByRole("heading", { name: "Pose les corps. La gravité fait le reste." }),
  ).toBeVisible();
});

test("calcule la gravité pas à pas sans durée finale", async ({ page }) => {
  await page.goto("/simulations/three-body");
  await waitForHydration(page);

  const canvas = page.locator('canvas[aria-label^="Simulation gravitationnelle pas à pas"]');
  await expect(canvas).toHaveAttribute("data-body-count", "2");
  await expect(canvas).toHaveAttribute("data-time-days", "0.000");

  await page.getByRole("button", { name: "Lancer la gravité" }).click();
  await expect(page.getByRole("button", { name: "Mettre en pause" })).toBeVisible();
  await expect(canvas).not.toHaveAttribute("data-time-days", "0.000");

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("En pause", { exact: true })).toBeVisible();
  await expect(canvas).toHaveAttribute("data-draggable", "false");
  await expect(page.getByText("RÉINITIALISE POUR MODIFIER LES POSITIONS")).toBeVisible();
  await expect(page.getByText("Il n’existe aucune durée maximale.")).toBeVisible();

  const positionX = page.getByRole("spinbutton", { name: "Aster — Position X" });
  const pausedPositionX = await positionX.inputValue();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const positions = JSON.parse(
    (await canvas.getAttribute("data-body-screen-positions"))!,
  ) as Array<{ x: number; y: number }>;
  await page.mouse.move(box!.x + positions[0].x, box!.y + positions[0].y);
  await page.mouse.down();
  await page.mouse.move(box!.x + positions[0].x + 70, box!.y + positions[0].y - 45);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging-body", "");
  await expect(positionX).toHaveValue(pausedPositionX);

  await page.getByRole("button", { name: "Revenir aux conditions initiales" }).click();
  await expect(canvas).toHaveAttribute("data-draggable", "true");
  await expect(page.getByText("GLISSE LES CORPS POUR LES REPOSITIONNER")).toBeVisible();
});

test("construit librement un système à trois corps", async ({ page }) => {
  await page.goto("/simulations/three-body");
  await waitForHydration(page);

  const canvas = page.locator('canvas[aria-label^="Simulation gravitationnelle pas à pas"]');
  await page.getByRole("button", { name: "Ajouter un troisième corps" }).click();
  await expect(canvas).toHaveAttribute("data-body-count", "3");

  const mass = page.getByRole("spinbutton", { name: "Cygnus — Masse" });
  const position = page.getByRole("spinbutton", { name: "Cygnus — Position X" });
  const velocity = page.getByRole("spinbutton", { name: "Cygnus — Vitesse Y" });
  await mass.fill("0.4");
  await position.fill("1.2");
  await velocity.fill("-12");
  await expect(mass).toHaveValue("0.4");
  await expect(canvas).toHaveAttribute("data-time-days", "0.000");
});

test("un preset ne fait que charger des conditions initiales", async ({ page }) => {
  await page.goto("/simulations/three-body");
  await waitForHydration(page);

  await page.getByRole("button", { name: /Orbite en huit/ }).click();
  await expect(page.locator('canvas[aria-label^="Simulation gravitationnelle pas à pas"]')).toHaveAttribute(
    "data-body-count",
    "3",
  );
  await expect(page.getByRole("spinbutton", { name: "Aster — Position X" })).toHaveValue("-0.6984");
  await expect(page.getByText("Aucune position future n’est connue")).toBeVisible();
});

test("garde un référentiel fixe et dézoome quand le système dérive", async ({ page }) => {
  await page.goto("/simulations/three-body");
  await waitForHydration(page);

  const canvas = page.locator('canvas[aria-label^="Simulation gravitationnelle pas à pas"]');
  await page.getByRole("spinbutton", { name: "Aster — Vitesse X" }).fill("100");
  await page.getByRole("spinbutton", { name: "Boreal — Vitesse X" }).fill("100");
  const initialCameraX = await canvas.getAttribute("data-camera-x-au");
  const initialCameraY = await canvas.getAttribute("data-camera-y-au");
  const initialRadius = Number(await canvas.getAttribute("data-view-radius-au"));
  const initialGridStep = Number(await canvas.getAttribute("data-grid-step-au"));

  await page.getByRole("button", { name: "Lancer la gravité" }).click();
  await expect.poll(async () =>
    Number(await canvas.getAttribute("data-view-radius-au")),
  ).toBeGreaterThan(initialRadius);
  await expect.poll(async () =>
    Number(await canvas.getAttribute("data-grid-step-au")),
  ).toBeGreaterThan(initialGridStep);

  await expect(canvas).toHaveAttribute("data-camera-x-au", initialCameraX!);
  await expect(canvas).toHaveAttribute("data-camera-y-au", initialCameraY!);
});

test("repositionne un corps par glisser-déposer sur le canvas", async ({ page }) => {
  await page.goto("/simulations/three-body");
  await waitForHydration(page);

  const canvas = page.locator('canvas[aria-label^="Simulation gravitationnelle pas à pas"]');
  const positionX = page.getByRole("spinbutton", { name: "Aster — Position X" });
  const positionY = page.getByRole("spinbutton", { name: "Aster — Position Y" });
  const initialX = Number(await positionX.inputValue());
  const initialY = Number(await positionY.inputValue());
  const initialCameraX = await canvas.getAttribute("data-camera-x-au");
  const initialCameraY = await canvas.getAttribute("data-camera-y-au");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const positions = JSON.parse(
    (await canvas.getAttribute("data-body-screen-positions"))!,
  ) as Array<{ x: number; y: number }>;
  const startX = box!.x + positions[0].x;
  const startY = box!.y + positions[0].y;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY - 45, { steps: 6 });
  await expect(canvas).toHaveAttribute("data-dragging-body", "aster");
  await page.mouse.up();

  await expect.poll(async () => Number(await positionX.inputValue())).toBeGreaterThan(initialX);
  await expect.poll(async () => Number(await positionY.inputValue())).toBeGreaterThan(initialY);
  await expect(canvas).toHaveAttribute("data-time-days", "0.000");
  await expect(canvas).toHaveAttribute("data-camera-x-au", initialCameraX!);
  await expect(canvas).toHaveAttribute("data-camera-y-au", initialCameraY!);
});

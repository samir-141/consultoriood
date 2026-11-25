import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const viewports = [
  { width: 360, height: 800, name: "360-mobile" },
  { width: 768, height: 1024, name: "768-tablet" },
  { width: 1024, height: 768, name: "1024-desktop-small" },
  { width: 1440, height: 900, name: "1440-desktop-std" },
  { width: 1920, height: 1080, name: "1920-desktop-wide" },
];

test.describe("Agente Visual - Responsive, Capturas, Hero 100svh y Paleta Azul", () => {
  test.beforeAll(async () => {
    await mkdir(path.join(process.cwd(), "reports", "screenshots"), { recursive: true });
  });

  for (const vp of viewports) {
    test(`Renderizado responsivo, sin desbordamiento horizontal y captura en ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const startTime = Date.now();
      const res = await page.goto("/");
      const loadTime = Date.now() - startTime;

      expect(res?.status()).toBe(200);
      expect(loadTime).toBeLessThan(3000);

      // 1. Verificar Hero a pantalla completa
      const heroContainer = page.locator("[class*='heroContainer']");
      await expect(heroContainer).toBeVisible();

      const heroBox = await heroContainer.boundingBox();
      expect(heroBox).not.toBeNull();
      // Debe ocupar la altura de la pantalla (con tolerancia mínima)
      expect(heroBox!.height).toBeGreaterThanOrEqual(vp.height * 0.9);

      // 2. Verificar que NO exista scroll horizontal
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // 3. Verificar que los botones táctiles principales midan al menos 44px de alto
      const buttons = page.locator("a.button, a.button-secondary, header a");
      const count = await buttons.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box && box.height > 0) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }

      // 4. Verificar coherencia de la paleta azul
      const blueDeepToken = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue("--blue-deep").trim();
      });
      expect(blueDeepToken).toBeTruthy();

      // 5. Tomar captura de pantalla
      const screenshotPath = path.join(
        process.cwd(),
        "reports",
        "screenshots",
        `viewport-${vp.name}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: false });
    });
  }

  test("Captura del nuevo flujo de reserva en móvil (360px) y escritorio (1440px)", async ({ page }) => {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/reservar");
      await expect(page.locator("button:has-text('Disponible')").first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(350); // esperar fin de animación de apertura

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      const screenshotPath = path.join(
        process.cwd(),
        "reports",
        "screenshots",
        `reservar-${width}px.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  });
});

import { test, expect } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";
const html = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../downloads/Gravity-Cafe.html",
);

test("single HTML plays over file:// with the network offline, embedded fonts and all three GLBs", async ({
  page,
  context,
}) => {
  const errors = [],
    network = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  const source = await readFile(html, "utf8");
  expect(source).not.toMatch(
    /<script\b[^>]*src=|<link\b[^>]*rel="(?:stylesheet|modulepreload)"/i,
  );
  expect(source).toContain("data:font/woff2;base64,");
  expect(source).toContain("data:model/gltf-binary;base64,");
  expect(source).not.toMatch(/url\(["']?\/?fonts\//);
  await context.setOffline(true);
  await page.addInitScript(() => {
    // La simulazione e il caricamento restano reali; saltiamo solo i draw GPU ripetuti in CI.
    for (const name of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
    ]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args) {
        if (window.__drawOfflineFrame) return original.apply(this, args);
      };
    }
    window.__loadedGLBs = 0;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (String(args[0]?.url ?? args[0]).startsWith("data:model/gltf-binary;"))
        window.__loadedGLBs++;
      return response;
    };
  });
  const time = new Date("2026-11-27T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto(pathToFileURL(html).href);
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#station-number")).toHaveText("01 / 08");
  await expect.poll(() => page.evaluate(() => window.__loadedGLBs)).toBe(3);
  await page.locator('[data-level="7"]').click();
  await expect(page.locator("#station-number")).toHaveText("08 / 08");
  await page.locator('[data-level="0"]').click();
  await page.locator("#start").click();
  await page.clock.runFor(3200);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "playing");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(100);
  await expect(page.locator("#inventory-name")).toHaveText("Tazza vuota");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1600);
  await expect(page.locator("#inventory-name")).toHaveText("Espresso");
  await page.locator("#pause").click();
  await expect(page.locator("#modal")).toBeVisible();
  const timer = await page.locator("#time").textContent();
  await page.clock.fastForward(60000);
  expect(await page.locator("#time").textContent()).toBe(timer);
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

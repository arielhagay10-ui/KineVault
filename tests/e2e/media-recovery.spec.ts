import { expect } from "@playwright/test";
import { test } from "./published-catalog.helpers";

test("a failed WebM source falls back to MP4", async ({ page, publishedCableRaise }) => {
  await page.route(/\/storage\/v1\/object\/sign\/.*\.webm\?/, route => route.abort());
  await page.goto(`/exercises/${publishedCableRaise.slug}`);
  const video = page.locator("video");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => ({
    ready: element.readyState >= 2, error: element.error?.code ?? null,
    format: element.currentSrc ? new URL(element.currentSrc).pathname.split(".").pop() : null,
  }))).toEqual({ ready: true, error: null, format: "mp4" });
});

test("failed media can reload fresh links and resume playback", async ({ page, publishedCableRaise }) => {
  const media = /\/storage\/v1\/object\/sign\/.*\.(webm|mp4)\?/;
  await page.route(media, route => route.abort());
  await page.goto(`/exercises/${publishedCableRaise.slug}`);
  await expect(page.getByRole("alert").filter({ hasText: "The demonstration could not be loaded" })).toBeVisible();
  await page.unroute(media);
  await page.getByRole("button", { name: "Reload demonstration", exact: true }).click();
  const video = page.locator("video");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => ({
    ready: element.readyState >= 2, error: element.error?.code ?? null,
  }))).toEqual({ ready: true, error: null });
  await video.evaluate((element: HTMLVideoElement) => element.play());
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Reload demonstration", exact: true })).toHaveCount(0);
});

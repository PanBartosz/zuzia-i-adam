import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import type { GalleryPage } from "../../lib/gallery";
import sharp from "sharp";
import { Pool } from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const database = new Pool({ connectionString: process.env.DATABASE_URL });
const baseURL = "http://localhost:3000";
let admin: APIRequestContext;
let event: {
  uploadToken: string;
  galleryToken: string;
  uploadEnabled: boolean;
  galleryEnabled: boolean;
};
const createdIds: string[] = [];
let fixture: Buffer;
let cropBefore: Buffer;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ playwright }) => {
  admin = await playwright.request.newContext({ baseURL });
  const login = await admin.post("/api/admin/login", {
    data: {
      email: process.env.ADMIN_EMAIL ?? "admin@zuziaiadam.pl",
      password: process.env.ADMIN_PASSWORD ?? "zmien-to-przed-weselem",
    },
  });
  expect(login.ok()).toBeTruthy();
  event = (await (await admin.get("/api/admin/event")).json()).event;
  await admin.patch("/api/admin/event", {
    data: { uploadEnabled: true, galleryEnabled: true },
  });
  fixture = await sharp("public/assets/boho-hero.png")
    .resize(1000, 750, { fit: "cover" })
    .jpeg()
    .toBuffer();
  await fs.mkdir("output/playwright", { recursive: true });
  await fs.writeFile("output/playwright/wesele.jpg", fixture);
  for (let i = 0; i < 3; i++) {
    const uploaded = await admin.post(`/api/upload/${event.uploadToken}`, {
      multipart: {
        guestName: "Test regresji UX",
        file: {
          name: `ux-test-${Date.now()}-${i}.jpg`,
          mimeType: "image/jpeg",
          buffer: fixture,
        },
      },
    });
    expect(uploaded.ok()).toBeTruthy();
    const photo = (await uploaded.json()).photo;
    createdIds.push(photo.id);
    if (i < 2)
      expect(
        (
          await admin.patch(`/api/admin/photos/${photo.id}`, {
            data: { action: "publish" },
          })
        ).ok(),
      ).toBeTruthy();
  }
});

test.afterAll(async () => {
  if (event)
    await admin.patch("/api/admin/event", {
      data: {
        uploadEnabled: event.uploadEnabled,
        galleryEnabled: event.galleryEnabled,
      },
    });
  const { rows: photos } = await database.query(
    'SELECT * FROM "Photo" WHERE id = ANY($1::text[])',
    [createdIds],
  );
  await database.query('DELETE FROM "Photo" WHERE id = ANY($1::text[])', [
    createdIds,
  ]);
  await database.query(
    'DELETE FROM "AuditLog" WHERE "entityId" = ANY($1::text[])',
    [createdIds],
  );
  for (const photo of photos) {
    for (const file of [
      photo.originalPath,
      photo.webPath,
      photo.thumbPath,
      photo.publishedPath,
    ]) {
      if (file)
        await fs
          .unlink(path.resolve(process.env.STORAGE_ROOT ?? "data", file))
          .catch(() => {});
    }
  }
  await admin?.dispose();
  await database.end();
});

test("private access: home requires a code and both codes unlock the album", async ({ page }) => {
  const home = await page.goto("/");
  expect(page.url()).toBe(`${baseURL}/`);
  const html = await home!.text();
  expect(html).not.toContain(event.uploadToken);
  expect(html).not.toContain(event.galleryToken);
  await page.getByLabel("Kod lub hasło dostępu").fill("wrong-access-code");
  await page.getByRole("button", { name: "Otwórz album" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nieprawidłowy kod dostępu." })).toBeVisible();
  for (const [code, other] of [[event.uploadToken, event.galleryToken], [event.galleryToken, event.uploadToken]]) {
    await page.goto("/");
    await page.getByLabel("Kod lub hasło dostępu").fill(code);
    await page.getByRole("button", { name: "Otwórz album" }).click();
    await page.waitForURL(`${baseURL}/u/${encodeURIComponent(code)}`);
    await expect(page.getByRole("heading", { name: "Zuzanna & Adam" })).toBeVisible();
    expect(await page.content()).not.toContain(other);
  }
});

test("upload: duplicate selection, removal, retry and clear success", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/u/${event.uploadToken}`);
  await expect(
    page.getByRole("heading", { name: "Zuzanna & Adam" }),
  ).toBeVisible();
  const picker = page.locator('input[type="file"]');
  const payload = {
    name: "wesele.jpg",
    mimeType: "image/jpeg",
    buffer: fixture,
  };
  await picker.setInputFiles("output/playwright/wesele.jpg");
  await picker.setInputFiles("output/playwright/wesele.jpg");
  await expect(page.locator(".upload-row")).toHaveCount(1);
  await expect(
    page.getByText("Pominięto powtórnie wybrane pliki: 1."),
  ).toBeVisible();
  await picker.setInputFiles([{ ...payload, name: "drugie.jpg" }]);
  await expect(page.locator(".upload-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Usuń drugie.jpg" }).click();
  let attempts = 0;
  await page.route("**/api/upload/**", async (route) => {
    attempts++;
    await route.fulfill({
      status: attempts === 1 ? 503 : 201,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1 ? { error: "Spróbuj ponownie." } : { ok: true },
      ),
    });
  });
  await page
    .getByRole("button", { name: "Wyślij 1 zdjęcie", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ponów wysyłanie (1)" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Ponów wysyłanie (1)" }).click();
  await expect(
    page.getByRole("heading", { name: "Zdjęcia są już u nas. Dziękujemy!" }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  await page.screenshot({
    path: "output/playwright/upload-success-mobile.png",
    fullPage: true,
  });
});

test("gallery: direct entry, viewer keyboard, close, selection and JPEG/ZIP downloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/u/${event.galleryToken}`);
  await expect(
    page.getByRole("tab", { name: "Galeria", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Otwórz zdjęcie 1", exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: "Podgląd zdjęć" });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    viewer.getByText("Wspomnienie 2", { exact: true }),
  ).toBeVisible();
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 80, y: 400 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 250, y: 405 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  await expect(
    viewer.getByText("Wspomnienie 1", { exact: true }),
  ).toBeVisible();
  const jpgPromise = page.waitForEvent("download");
  await viewer.getByRole("link", { name: "Pobierz", exact: true }).click();
  const jpg = await jpgPromise;
  expect(jpg.suggestedFilename()).toMatch(/\.jpg$/);
  expect(await jpg.failure()).toBeNull();
  await page.screenshot({
    path: "output/playwright/gallery-viewer-mobile.png",
  });
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Otwórz zdjęcie 1", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Wybierz zdjęcia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Wybierz zdjęcie 1", exact: true })
    .click();
  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz wybrane (1)" }).click();
  const zip = await zipPromise;
  await zip.saveAs("output/playwright/selected-guest.zip");
  const entries = execFileSync(
    "unzip",
    ["-Z1", "output/playwright/selected-guest.zip"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatch(/\.jpg$/);
  const extracted = execFileSync("unzip", [
    "-p",
    "output/playwright/selected-guest.zip",
    entries[0],
  ]);
  expect((await sharp(extracted).metadata()).format).toBe("jpeg");
});

test("public downloads only contain published photos and respect gallery locking", async ({
  request,
}) => {
  const root = `/api/gallery/${event.galleryToken}`;
  const listed = await (await request.get(`${root}/photos`)).json();
  expect(Object.keys(listed.photos[0]).sort()).toEqual(["id", "updatedAt"]);
  expect(
    (await request.get(`${root}/photos/${createdIds[2]}?download=1`)).status(),
  ).toBe(404);
  expect(
    (
      await request.post(`${root}/download`, { data: { ids: [createdIds[2]] } })
    ).status(),
  ).toBe(404);
  expect(
    (await request.post(`${root}/download`, { data: { ids: [] } })).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/gallery/wrong-token/download")).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/admin/download", { data: {} })).status(),
  ).toBe(401);
  const allPhotos = await request.get(`${root}/download`);
  expect(allPhotos.ok()).toBeTruthy();
  await fs.writeFile("output/playwright/all-guest.zip", await allPhotos.body());
  expect(
    execFileSync("unzip", ["-Z1", "output/playwright/all-guest.zip"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n"),
  ).toHaveLength(listed.total);
  await admin.patch("/api/admin/event", { data: { galleryEnabled: false } });
  try {
    for (const suffix of [
      "/photos",
      `/photos/${createdIds[0]}?download=1`,
      "/download",
    ]) {
      expect((await request.get(`${root}${suffix}`)).status()).toBe(403);
    }
  } finally {
    await admin.patch("/api/admin/event", { data: { galleryEnabled: true } });
  }
});

test("crop remains private and survives unpublish/republish", async () => {
  const id = createdIds[2];
  const response = await admin.post(`/api/admin/photos/${id}/crop`, {
    data: {
      crop: { x: 200, y: 100, width: 640, height: 480 },
      zoom: 1.5,
      point: { x: -30, y: 20 },
    },
  });
  expect(response.ok()).toBeTruthy();
  const photo = (await response.json()).photo;
  expect(photo.status).toBe("NEW");
  expect(photo.crop.zoom).toBe(1.5);
  cropBefore = await (
    await admin.get(`/api/admin/photos/${id}/file?variant=published`)
  ).body();
  await admin.patch(`/api/admin/photos/${id}`, { data: { action: "publish" } });
  await admin.patch(`/api/admin/photos/${id}`, {
    data: { action: "unpublish" },
  });
  await admin.patch(`/api/admin/photos/${id}`, { data: { action: "publish" } });
  const after = await (
    await admin.get(`/api/admin/photos/${id}/file?variant=published`)
  ).body();
  expect(after.equals(cropBefore)).toBe(true);
  expect((await sharp(after).metadata()).width).toBe(640);
});

test("admin: preview, responsive crop, publication switch and selected original archive", async ({
  page,
}) => {
  await page.context().addCookies((await admin.storageState()).cookies);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Otwórz zdjęcie 1", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Podgląd zdjęć" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zamknij podgląd" }).click();
  const card = page.locator("article").first();
  const toggle = card.getByRole("switch");
  await toggle.click();
  await expect(card.getByText("Poza galerią", { exact: true })).toBeVisible();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(
    card.getByText("W galerii gości", { exact: true }),
  ).toBeVisible();
  await expect(toggle).toBeEnabled();
  await card.getByRole("button", { name: "Popraw kadr" }).click();
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(
    page.getByRole("button", { name: "Zapisz kadr" }),
  ).toBeInViewport();
  await page.getByRole("slider", { name: "Powiększenie" }).fill("1.8");
  await page.getByRole("button", { name: "Zapisz kadr" }).click();
  await expect(
    page.getByRole("dialog", { name: "Kadrowanie zdjęcia" }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .locator("article")
    .first()
    .getByRole("button", { name: "Popraw kadr" })
    .click();
  await expect(page.getByRole("slider", { name: "Powiększenie" })).toHaveValue(
    /1\.8/,
  );
  await page.screenshot({ path: "output/playwright/crop-mobile.png" });
  await page.getByRole("button", { name: "Zamknij kadrowanie" }).click();
  await page
    .locator("article")
    .first()
    .getByRole("checkbox", { name: "Do pobrania" })
    .check();
  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz wybrane (1)" }).click();
  const zip = await zipPromise;
  await zip.saveAs("output/playwright/selected-admin.zip");
  const entries = execFileSync(
    "unzip",
    ["-Z1", "output/playwright/selected-admin.zip"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  expect(entries).toHaveLength(1);
  expect(
    execFileSync("unzip", [
      "-p",
      "output/playwright/selected-admin.zip",
      entries[0],
    ]).equals(fixture),
  ).toBe(true);
});

test("gallery pagination has no duplicates or missing photos", async ({
  request,
}) => {
  const ids = Array.from({ length: 50 }, () => randomUUID());
  await database.query(
    `INSERT INTO "Photo" (id, "eventId", "originalPath", "thumbPath", "webPath", "publishedPath", "mimeType", size, status, "createdAt", "updatedAt") SELECT copy.id, photo."eventId", photo."originalPath", photo."thumbPath", photo."webPath", photo."publishedPath", photo."mimeType", photo.size, 'PUBLISHED', NOW(), NOW() FROM unnest($1::text[]) AS copy(id) CROSS JOIN "Photo" photo WHERE photo.id = $2`,
    [ids, createdIds[0]],
  );
  try {
    const seen: string[] = [];
    let cursor: string | null = null;
    let total = 0;
    do {
      const response: APIResponse = await request.get(
        `/api/gallery/${event.galleryToken}/photos${cursor ? `?cursor=${cursor}` : ""}`,
      );
      expect(response.ok()).toBeTruthy();
      const data: GalleryPage = await response.json();
      expect(data.photos.length).toBeLessThanOrEqual(48);
      seen.push(...data.photos.map((photo: { id: string }) => photo.id));
      cursor = data.nextCursor;
      total = data.total;
    } while (cursor);
    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
  } finally {
    await database.query('DELETE FROM "Photo" WHERE id = ANY($1::text[])', [
      ids,
    ]);
  }
});

test("closed upload and gallery have clear independent states", async ({
  page,
}) => {
  await admin.patch("/api/admin/event", {
    data: { uploadEnabled: false, galleryEnabled: false },
  });
  try {
    await page.goto(`/u/${event.uploadToken}`);
    await expect(
      page.getByRole("heading", { name: "Dziękujemy za Wasze zdjęcia!" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wybierz zdjęcia", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Galeria", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Wspomnienia jeszcze się zbierają" }),
    ).toBeVisible();
    await admin.patch("/api/admin/event", { data: { galleryEnabled: true } });
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Galeria", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    await admin.patch("/api/admin/event", {
      data: { uploadEnabled: true, galleryEnabled: true },
    });
  }
});

test("desktop and mobile layouts have no horizontal overflow or unloaded gallery images", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await page.goto(`/u/${event.uploadToken}`);
    await expect(
      page.getByRole("button", { name: "Wybierz zdjęcia", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/upload-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Galeria", exact: true }).click();
    await page.locator(".gallery-image img").first().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator(".gallery-image img")
          .evaluateAll((images) =>
            images.every(
              (image) => (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/gallery-${width}.png`,
      fullPage: true,
    });
  }
  await page.context().addCookies((await admin.storageState()).cookies);
  await page.goto("/admin");
  await page.screenshot({
    path: "output/playwright/admin-redesign-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/admin-redesign-mobile.png",
    fullPage: true,
  });
});

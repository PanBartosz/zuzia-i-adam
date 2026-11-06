import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient, type Event } from "../generated/prisma/client";
import { seedEvent } from "../prisma/seed-event";
import sharp from "sharp";

// Real PostgreSQL queries and real route handlers, with an isolated in-process
// database and temporary photo files. No production connection or server needed.
const database = new PGlite();
const prisma = new PrismaClient({ adapter: new PrismaPGlite(database) });
let storageRoot: string;
let event: Event;
let image: Buffer;
let adminCookie: string;
let accessApi: typeof import("../app/api/guest/access/route");
let uploadApi: typeof import("../app/api/upload/[token]/route");
let galleryApi: typeof import("../app/api/gallery/[token]/photos/[id]/route");
let eventApi: typeof import("../app/api/admin/event/route");
let guestPage: typeof import("../app/u/[token]/page");
let homePage: typeof import("../app/page");

function request(url: string, options?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://album.example.test${url}`, options);
}

async function settings(uploadEnabled: boolean, galleryEnabled: boolean) {
  const response = await eventApi.PATCH(request("/api/admin/event", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ uploadEnabled, galleryEnabled }),
  }));
  assert.equal(response.status, 200);
}

function access(code: unknown) {
  return accessApi.POST(request("/api/guest/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }));
}

function upload(token: string) {
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "guest.jpg");
  return uploadApi.POST(request(`/api/upload/${encodeURIComponent(token)}`, {
    method: "POST", body: form,
  }), { params: Promise.resolve({ token }) });
}

function photo(token: string, id = "published-photo") {
  return galleryApi.GET(request(`/api/gallery/${encodeURIComponent(token)}/photos/${id}`), {
    params: Promise.resolve({ token, id }),
  });
}

function page(token: string) {
  return guestPage.default({ params: Promise.resolve({ token }) });
}

before(async () => {
  await database.exec(await readFile("prisma/migrations/20260619125511_init/migration.sql", "utf8"));
  storageRoot = await mkdtemp(path.join(tmpdir(), "guest-access-test-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  (globalThis as { prisma?: PrismaClient }).prisma = prisma;

  // Import after wiring the isolated database and storage, so the application's
  // normal DAL, authorization and image processing all run unchanged.
  accessApi = await import("../app/api/guest/access/route");
  uploadApi = await import("../app/api/upload/[token]/route");
  galleryApi = await import("../app/api/gallery/[token]/photos/[id]/route");
  eventApi = await import("../app/api/admin/event/route");
  guestPage = await import("../app/u/[token]/page");
  homePage = await import("../app/page");
  event = await seedEvent(prisma, {});
  image = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#b46f47" } }).jpeg().toBuffer();
  await mkdir(path.join(storageRoot, "published"));
  await writeFile(path.join(storageRoot, "published", "test.webp"), await sharp(image).webp().toBuffer());
  await prisma.event.create({
    data: { id: "other-event", uploadToken: randomBytes(18).toString("hex"), galleryToken: randomBytes(18).toString("hex") },
  });
  for (const [id, status, eventId] of [
    ["published-photo", "PUBLISHED", event.id],
    ["hidden-photo", "HIDDEN", event.id],
    ["new-photo", "NEW", event.id],
    ["other-event-photo", "PUBLISHED", "other-event"],
  ] as const) {
    await prisma.photo.create({ data: {
      id, eventId, status,
      originalPath: "originals/private.jpg", publishedPath: "published/test.webp",
      mimeType: "image/jpeg", size: 100,
    } });
  }
  const user = await prisma.adminUser.create({ data: {
    email: "access-test@example.test", passwordHash: "unused-test-fixture",
  } });
  const { signSession, sessionCookieName } = await import("../lib/session");
  adminCookie = `${sessionCookieName}=${await signSession({ sub: user.id, email: user.email })}`;
}, { timeout: 30000 });

after(async () => {
  await prisma.$disconnect();
  await database.close();
  delete (globalThis as { prisma?: PrismaClient }).prisma;
  if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
});

test("new installations generate private random access codes", () => {
  assert.match(event.uploadToken, /^[A-Za-z0-9_-]{24}$/);
  assert.match(event.galleryToken, /^[A-Za-z0-9_-]{24}$/);
  assert.notEqual(event.uploadToken, event.galleryToken);
});

test("home exposes only the access form, without redirecting or leaking codes/photos", async () => {
  const html = renderToStaticMarkup(homePage.default());
  assert.match(html, /Kod lub hasło dostępu/);
  assert(!html.includes("http-equiv"));
  for (const secret of [event.uploadToken, event.galleryToken, "published-photo", "hidden-photo", "originals/private.jpg"]) {
    assert(!html.includes(secret));
  }
  const config = (await import("../next.config")).default;
  const headers = await config.headers!();
  assert(headers.some((rule) => rule.headers.some((header) => header.key === "Referrer-Policy" && header.value === "no-referrer")));
});

test("missing, malformed and wrong credentials cannot unlock pages or APIs", async () => {
  for (const code of [undefined, null, false, 123, {}, [], "", " ", "wrong-code", "x".repeat(257)]) {
    const response = await access(code);
    assert.equal(response.status, 403, JSON.stringify(code));
    assert.deepEqual(await response.json(), { error: "Nieprawidłowy kod dostępu." });
  }
  const malformed = await accessApi.POST(request("/api/guest/access", { method: "POST", body: "{" }));
  assert.equal(malformed.status, 403);
  await assert.rejects(page("wrong-code"), /404/);
  assert.equal((await upload("wrong-code")).status, 403);
  assert.equal((await photo("wrong-code")).status, 403);
  assert.equal((await upload("")).status, 403);
  assert.equal((await photo("")).status, 403);
});

test("either code works manually or via QR without revealing the other code", async () => {
  for (const [token, other] of [[event.uploadToken, event.galleryToken], [event.galleryToken, event.uploadToken]]) {
    const response = await access(`  ${token}  `);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: `/u/${token}` });
    const guest = await page(token);
    const props = JSON.stringify(guest.props);
    assert(!props.includes(other));
    assert(!props.includes("uploadToken"));
    assert(!props.includes("galleryToken"));
    assert(!renderToStaticMarkup(guest).includes(other));
  }
});

test("all four admin switch combinations gate real uploads and photo bytes for both codes", async () => {
  for (const uploadEnabled of [false, true]) {
    for (const galleryEnabled of [false, true]) {
      await settings(uploadEnabled, galleryEnabled);
      for (const token of [event.uploadToken, event.galleryToken]) {
        const uploaded = await upload(token);
        assert.equal(uploaded.status, uploadEnabled ? 200 : 403);
        const displayed = await photo(token);
        assert.equal(displayed.status, galleryEnabled ? 200 : 403);
        if (galleryEnabled) {
          assert.equal(displayed.headers.get("cache-control"), "private, no-store");
          assert.equal(displayed.headers.get("content-type"), "image/webp");
          assert((await displayed.arrayBuffer()).byteLength > 0);
        }
        const guest = await page(token);
        const html = renderToStaticMarkup(guest);
        assert.equal(html.includes('type="file"'), uploadEnabled);
        assert.equal(JSON.stringify(guest.props).includes("published-photo"), galleryEnabled);
        assert(!JSON.stringify(guest.props).includes("hidden-photo"));
        assert(!JSON.stringify(guest.props).includes("new-photo"));
      }
      assert.equal((await upload("wrong-code")).status, 403);
      assert.equal((await photo("wrong-code")).status, 403);
    }
  }
});

test("unpublished photos, other events and admin originals remain inaccessible", async () => {
  await settings(true, true);
  for (const token of [event.uploadToken, event.galleryToken]) {
    for (const id of ["hidden-photo", "new-photo", "other-event-photo", "missing-photo"]) {
      assert.equal((await photo(token, id)).status, 404);
    }
    const originalApi = await import("../app/api/admin/photos/[id]/file/route");
    assert.equal((await originalApi.GET(request("/api/admin/photos/published-photo/file?variant=original"), {
      params: Promise.resolve({ id: "published-photo" }),
    })).status, 401);
  }
});

test("closing access blocks URLs and upload forms obtained before the switch", async () => {
  await settings(true, true);
  for (const token of [event.uploadToken, event.galleryToken]) {
    await page(token);
    assert.equal((await photo(token)).status, 200);
  }
  await settings(false, false);
  for (const token of [event.uploadToken, event.galleryToken]) {
    assert.equal((await photo(token)).status, 403);
    assert.equal((await upload(token)).status, 403);
    assert.equal((await access(token)).status, 200);
  }
});

test("gallery listings, JPEG downloads, thumbnails and archives require a code and an open gallery", async () => {
  const listing = await import("../app/api/gallery/[token]/photos/route");
  const archive = await import("../app/api/gallery/[token]/download/route");
  for (const galleryEnabled of [false, true]) {
    await settings(true, galleryEnabled);
    for (const token of [event.uploadToken, event.galleryToken, "wrong-code"]) {
      const allowed = galleryEnabled && token !== "wrong-code";
      const params = { params: Promise.resolve({ token }) };
      const listed = await listing.GET(request(`/api/gallery/${token}/photos`), params);
      assert.equal(listed.status, allowed ? 200 : 403);
      if (allowed) {
        assert.deepEqual((await listed.json()).photos.map((item: { id: string }) => item.id), ["published-photo"]);
      }
      for (const query of ["?download=1", "?variant=thumb"]) {
        const file = await galleryApi.GET(request(`/api/gallery/${token}/photos/published-photo${query}`), {
          params: Promise.resolve({ token, id: "published-photo" }),
        });
        assert.equal(file.status, allowed ? 200 : 403);
      }
      const archived = await archive.POST(request(`/api/gallery/${token}/download`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["published-photo"], check: true }),
      }), params);
      assert.equal(archived.status, allowed ? 200 : 403);
      if (allowed) assert.deepEqual(await archived.json(), { count: 1 });
    }
  }
});

test("guests cannot read admin data, open switches or rotate credentials", async () => {
  await settings(false, false);
  assert.equal((await eventApi.GET(request("/api/admin/event"))).status, 401);
  const response = await eventApi.PATCH(request("/api/admin/event", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadEnabled: true, galleryEnabled: true, rotateAccess: true }),
  }));
  assert.equal(response.status, 401);
  const saved = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(saved.uploadToken, event.uploadToken);
  assert.equal(saved.galleryToken, event.galleryToken);
  assert.equal(saved.uploadEnabled, false);
  assert.equal(saved.galleryEnabled, false);
});

test("rotation revokes old codes and seeding never restores them or duplicates the event", async () => {
  await settings(true, true);
  const response = await eventApi.PATCH(request("/api/admin/event", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ rotateAccess: true }),
  }));
  assert.equal(response.status, 200);
  const updated = (await response.json()).event;
  assert.notEqual(updated.uploadToken, event.uploadToken);
  assert.notEqual(updated.galleryToken, event.galleryToken);
  for (const old of [event.uploadToken, event.galleryToken]) {
    assert.equal((await access(old)).status, 403);
    await assert.rejects(page(old), /404/);
    assert.equal((await upload(old)).status, 403);
    assert.equal((await photo(old)).status, 403);
  }
  const saved = await seedEvent(prisma, { UPLOAD_TOKEN: event.uploadToken, GALLERY_TOKEN: event.galleryToken });
  assert.equal(saved.uploadToken, updated.uploadToken);
  assert.equal(saved.galleryToken, updated.galleryToken);
  assert.equal(await prisma.event.count(), 2);
  for (const token of [updated.uploadToken, updated.galleryToken]) {
    assert.equal((await access(token)).status, 200);
    assert.equal((await upload(token)).status, 200);
    assert.equal((await photo(token)).status, 200);
  }
  const uploaded = await prisma.photo.findFirstOrThrow({ where: { originalName: "guest.jpg" } });
  assert.equal(uploaded.status, "NEW");
  assert.equal((await photo(updated.uploadToken, uploaded.id)).status, 404);
});

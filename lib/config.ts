import path from "node:path";

function resolveStorageRoot() {
  const configuredRoot = process.env.STORAGE_ROOT;
  if (!configuredRoot) return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  if (path.isAbsolute(configuredRoot)) return configuredRoot;
  return path.join(/* turbopackIgnore: true */ process.cwd(), configuredRoot);
}

export const appConfig = {
  baseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  storageRoot: resolveStorageRoot(),
  authSecret:
    process.env.AUTH_SECRET ??
    "local-dev-secret-change-before-wedding-please-use-a-long-random-value",
  maxUploadBytes: 40 * 1024 * 1024,
};

export const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

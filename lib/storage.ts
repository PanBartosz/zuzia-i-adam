import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { appConfig } from "@/lib/config";

export type PhotoVariant = "originals" | "thumbs" | "web" | "published";

const variantFolders: Record<PhotoVariant, string> = {
  originals: "originals",
  thumbs: "thumbs",
  web: "web",
  published: "published",
};

export function createPhotoId() {
  return crypto.randomUUID();
}

export function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export function getRelativePhotoPath(
  variant: PhotoVariant,
  photoId: string,
  extension: string,
) {
  const cleanExtension = extension.replace(/^\./, "").toLowerCase() || "bin";
  return path.join(variantFolders[variant], `${photoId}.${cleanExtension}`);
}

export function resolveStoragePath(relativePath: string) {
  const resolved = path.resolve(appConfig.storageRoot, relativePath);
  if (!resolved.startsWith(appConfig.storageRoot)) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function ensureStorageDirs() {
  await Promise.all(
    Object.values(variantFolders).map((folder) =>
      fs.mkdir(path.join(appConfig.storageRoot, folder), { recursive: true }),
    ),
  );
}

export async function writeStorageFile(relativePath: string, data: Buffer) {
  const fullPath = resolveStoragePath(relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);
}

export async function readStorageFile(relativePath: string) {
  return fs.readFile(resolveStoragePath(relativePath));
}

export async function storageFileExists(relativePath?: string | null) {
  if (!relativePath) return false;
  try {
    await fs.access(resolveStoragePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export function displayDownloadName(photoId: string, originalName?: string | null) {
  const safeOriginal = originalName ? safeFileName(originalName) : "";
  return safeOriginal || `${photoId}.jpg`;
}

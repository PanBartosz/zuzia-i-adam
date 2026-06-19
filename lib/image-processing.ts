import sharp from "sharp";
import { getRelativePhotoPath, resolveStoragePath, writeStorageFile } from "@/lib/storage";

export type ProcessedImage = {
  width?: number;
  height?: number;
  thumbPath?: string;
  webPath?: string;
  error?: string;
};

export async function processUploadedImage(photoId: string, input: Buffer) {
  const output: ProcessedImage = {};

  try {
    const normalized = sharp(input, { failOn: "none" }).rotate();
    const metadata = await normalized.metadata();
    output.width = metadata.width;
    output.height = metadata.height;

    const thumbPath = getRelativePhotoPath("thumbs", photoId, "webp");
    const webPath = getRelativePhotoPath("web", photoId, "webp");

    await Promise.all([
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(resolveStoragePath(thumbPath)),
      sharp(input, { failOn: "none" })
        .rotate()
        .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(resolveStoragePath(webPath)),
    ]);

    output.thumbPath = thumbPath;
    output.webPath = webPath;
  } catch (error) {
    output.error =
      error instanceof Error
        ? error.message
        : "Nie udało się wygenerować miniatury.";
  }

  return output;
}

export async function createPublishedImage(inputPath: string, photoId: string) {
  const publishedPath = getRelativePhotoPath("published", photoId, "webp");

  await sharp(resolveStoragePath(inputPath), { failOn: "none" })
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toFile(resolveStoragePath(publishedPath));

  return publishedPath;
}

export async function cropPublishedImage(
  inputPath: string,
  photoId: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const publishedPath = getRelativePhotoPath("published", photoId, "webp");
  const roundedCrop = {
    left: Math.max(0, Math.round(crop.x)),
    top: Math.max(0, Math.round(crop.y)),
    width: Math.max(1, Math.round(crop.width)),
    height: Math.max(1, Math.round(crop.height)),
  };

  await sharp(resolveStoragePath(inputPath), { failOn: "none" })
    .extract(roundedCrop)
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(resolveStoragePath(publishedPath));

  return publishedPath;
}

export async function placeholderThumb(photoId: string) {
  const thumbPath = getRelativePhotoPath("thumbs", photoId, "webp");
  const svg = Buffer.from(`
    <svg width="640" height="480" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" rx="28" fill="#f7f1e7"/>
      <rect x="48" y="48" width="544" height="384" rx="24" fill="#eadfce"/>
      <circle cx="244" cy="196" r="48" fill="#b46f47" opacity=".65"/>
      <path d="M112 360l140-128 88 80 60-52 128 100H112z" fill="#7b8b5f" opacity=".72"/>
    </svg>
  `);

  await writeStorageFile(thumbPath, await sharp(svg).webp({ quality: 82 }).toBuffer());
  return thumbPath;
}

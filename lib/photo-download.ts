import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { once } from "node:events";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { resolveStoragePath, storageFileExists } from "@/lib/storage";

type DownloadOptions = { ids?: string[]; status?: string; check: boolean };
export type ArchivePhoto = { path: string; name: string; jpeg?: boolean };

export async function readDownloadOptions(
  request: NextRequest,
): Promise<DownloadOptions | null> {
  try {
    let input: Record<string, unknown>;
    if (request.method === "GET") {
      input = {
        ids: request.nextUrl.searchParams.get("ids")?.split(","),
        status: request.nextUrl.searchParams.get("status") ?? undefined,
      };
    } else if (
      request.headers.get("content-type")?.includes("application/json")
    ) {
      input = await request.json();
    } else {
      const form = await request.formData();
      input = {
        ids: form.has("ids") ? JSON.parse(String(form.get("ids"))) : undefined,
        status: form.get("status") ?? undefined,
      };
    }
    if (!input || typeof input !== "object") return null;
    if (
      input.ids !== undefined &&
      (!Array.isArray(input.ids) ||
        !input.ids.length ||
        input.ids.length > 10000 ||
        !input.ids.every(
          (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id),
        ))
    )
      return null;
    if (
      input.status !== undefined &&
      (typeof input.status !== "string" ||
        !["ALL", "NEW", "SELECTED", "PUBLISHED", "HIDDEN", "REJECTED"].includes(
          input.status,
        ))
    )
      return null;
    return {
      ids: input.ids ? [...new Set(input.ids as string[])] : undefined,
      status: input.status as string | undefined,
      check: input.check === true,
    };
  } catch {
    return null;
  }
}

export async function archiveFilesExist(photos: ArchivePhoto[]) {
  for (const photo of photos) {
    if (!(await storageFileExists(photo.path))) return false;
  }
  return true;
}

export function photoArchiveResponse(
  photos: ArchivePhoto[],
  filename: string,
  signal: AbortSignal,
) {
  const archive = new ZipArchive({ store: true });
  const output = new PassThrough();
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
    archive.abort();
    output.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  output.once("close", () => {
    signal.removeEventListener("abort", abort);
    controller.abort();
    archive.abort();
  });
  const fail = (error: Error) => {
    controller.abort();
    archive.abort();
    output.destroy(error);
  };
  archive.on("error", fail);
  archive.on("warning", fail);
  archive.pipe(output);

  async function produce() {
    for (const photo of photos) {
      if (signal.aborted || controller.signal.aborted) {
        abort();
        return;
      }
      // Archiver starts reading appended streams immediately. Queue one image at a time.
      const jpeg = photo.jpeg
        ? await sharp(resolveStoragePath(photo.path))
            .jpeg({ quality: 94 })
            .toBuffer()
        : null;
      if (controller.signal.aborted) return;
      const consumed = once(archive, "entry", { signal: controller.signal });
      if (jpeg) archive.append(jpeg, { name: photo.name });
      else archive.file(resolveStoragePath(photo.path), { name: photo.name });
      await consumed;
    }
    await archive.finalize();
  }
  void produce().catch((error) => {
    if (!controller.signal.aborted) fail(error);
  });
  return new Response(Readable.toWeb(output) as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

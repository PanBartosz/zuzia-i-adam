"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Heart,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { EventDto, PhotoDto } from "@/lib/photo-dto";

type Props = {
  event: EventDto;
  photos: PhotoDto[];
  token: string;
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

const maxFileSize = 40 * 1024 * 1024;

export default function GuestExperience({ event, photos, token }: Props) {
  const [guestName, setGuestName] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPhotosRef = useRef<SelectedPhoto[]>([]);
  const galleryUrl = `/api/gallery/${token}/photos/`;

  const uploadableCount = useMemo(
    () => selectedPhotos.filter((photo) => photo.status === "queued" || photo.status === "error")
      .length,
    [selectedPhotos],
  );
  const completedCount = useMemo(
    () => selectedPhotos.filter((photo) => photo.status === "done").length,
    [selectedPhotos],
  );
  const activeCount = useMemo(
    () => selectedPhotos.filter((photo) => photo.status !== "done").length,
    [selectedPhotos],
  );
  const selectedGalleryPhoto =
    galleryIndex === null || !photos[galleryIndex] ? null : photos[galleryIndex];

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      selectedPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const showPreviousPhoto = useCallback(() => {
    if (!photos.length) return;
    setGalleryIndex((current) => {
      const index = current ?? 0;
      return index === 0 ? photos.length - 1 : index - 1;
    });
  }, [photos.length]);

  const showNextPhoto = useCallback(() => {
    if (!photos.length) return;
    setGalleryIndex((current) => {
      const index = current ?? 0;
      return index === photos.length - 1 ? 0 : index + 1;
    });
  }, [photos.length]);

  useEffect(() => {
    if (galleryIndex === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setGalleryIndex(null);
      if (event.key === "ArrowLeft") showPreviousPhoto();
      if (event.key === "ArrowRight") showNextPhoto();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [galleryIndex, showNextPhoto, showPreviousPhoto]);

  function openFilePicker() {
    if (!uploading) fileInputRef.current?.click();
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const accepted: SelectedPhoto[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!isImageFile(file)) {
        rejected.push(`${file.name}: to nie wygląda jak zdjęcie`);
        continue;
      }

      if (file.size > maxFileSize) {
        rejected.push(`${file.name}: maksymalnie 40 MB`);
        continue;
      }

      accepted.push({
        id: createClientId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      });
    }

    setSelectionError(rejected.slice(0, 3).join(". "));
    if (accepted.length) {
      setSelectedPhotos((current) => [...current, ...accepted]);
    }
  }

  function removePhoto(id: string) {
    setSelectedPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  async function uploadSelectedPhotos() {
    if (uploading || uploadableCount === 0) return;
    setUploading(true);

    const idsToUpload = selectedPhotosRef.current
      .filter((photo) => photo.status === "queued" || photo.status === "error")
      .map((photo) => photo.id);

    for (const id of idsToUpload) {
      const photo = selectedPhotosRef.current.find((item) => item.id === id);
      if (!photo) continue;
      await uploadPhoto(photo);
    }

    setUploading(false);
  }

  function uploadPhoto(photo: SelectedPhoto) {
    return new Promise<void>((resolve) => {
      setSelectedPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? { ...item, status: "uploading", progress: Math.max(item.progress, 4), error: undefined }
            : item,
        ),
      );

      const formData = new FormData();
      formData.append("file", photo.file);
      if (guestName.trim()) formData.append("guestName", guestName.trim());

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/upload/${event.uploadToken}`);

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) return;
        const progress = Math.max(
          5,
          Math.min(95, Math.round((progressEvent.loaded / progressEvent.total) * 100)),
        );
        setSelectedPhotos((current) =>
          current.map((item) => (item.id === photo.id ? { ...item, progress } : item)),
        );
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setSelectedPhotos((current) =>
            current.map((item) =>
              item.id === photo.id ? { ...item, status: "done", progress: 100 } : item,
            ),
          );
          resolve();
          return;
        }

        const message = parseUploadError(xhr.responseText);
        setSelectedPhotos((current) =>
          current.map((item) =>
            item.id === photo.id ? { ...item, status: "error", progress: 0, error: message } : item,
          ),
        );
        resolve();
      };

      xhr.onerror = () => {
        setSelectedPhotos((current) =>
          current.map((item) =>
            item.id === photo.id
              ? {
                  ...item,
                  status: "error",
                  progress: 0,
                  error: "Nie udało się wysłać. Spróbuj ponownie.",
                }
              : item,
          ),
        );
        resolve();
      };

      xhr.send(formData);
    });
  }

  return (
    <main className="boho-bg min-h-screen">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.62fr)] lg:items-center lg:px-8">
        <div className="max-w-2xl pt-3 lg:pt-0">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/60 px-3 py-1.5 text-sm font-bold text-[#4e5d3e] backdrop-blur">
            <Heart size={16} fill="currentColor" />
            {event.weddingDate
              ? new Intl.DateTimeFormat("pl-PL", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }).format(new Date(event.weddingDate))
              : "Zdjęcia z naszego dnia"}
          </div>

          <h1 className="font-serif text-[clamp(3.2rem,9vw,6.8rem)] leading-[0.88] text-[#3b2a20]">
            {event.coupleName}
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-8 text-[#5c4a3b] sm:text-xl">
            Wybierz zdjęcia z telefonu i wyślij je Zuzi i Adamowi.
          </p>
        </div>

        <div className="paper-surface rounded-[8px] border border-[var(--line)] p-4 shadow-[0_24px_70px_rgba(52,38,29,0.16)] sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-[#6f8056]">Wrzucanie zdjęć</p>
              <h2 className="mt-1 font-serif text-3xl">Dodaj swoje ujęcia</h2>
            </div>
            {event.uploadEnabled ? (
              <span className="status-pill bg-[#6f8056]/12 text-[#4e5d3e]">Otwarte</span>
            ) : (
              <span className="status-pill bg-[#8d3e2f]/10 text-[#7a3529]">Zamknięte</span>
            )}
          </div>

          {event.uploadEnabled ? (
            <>
              <label className="mb-4 block">
                <span className="text-sm font-bold">Imię, opcjonalnie</span>
                <input
                  className="focus-ring mt-1 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white/80 px-3"
                  placeholder="np. Ciocia Ania"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                />
              </label>

              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={onFilesSelected}
              />

              <div className="rounded-[8px] border border-[var(--line)] bg-white/72 p-3">
                {selectedPhotos.length === 0 ? (
                  <button
                    type="button"
                    className="focus-ring flex min-h-40 w-full flex-col items-center justify-center rounded-[8px] border border-dashed border-[#6f8056]/45 bg-[#6f8056]/8 px-4 py-6 text-center transition hover:bg-[#6f8056]/12"
                    onClick={openFilePicker}
                  >
                    <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#4e5d3e] text-white shadow-sm">
                      <ImagePlus size={24} />
                    </span>
                    <span className="text-lg font-black text-[#3c2c22]">
                      Wybierz zdjęcia z telefonu
                    </span>
                    <span className="mt-2 text-sm font-semibold text-[var(--muted)]">
                      Możesz wybrać kilka zdjęć naraz.
                    </span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[8px] bg-[#f7f1e7] p-3">
                      <p className="text-sm font-black text-[#3c2c22]">
                        {uploadableCount > 0
                          ? `${uploadableCount} ${photoWord(uploadableCount)} gotowe do wysłania`
                          : "Wszystkie wybrane zdjęcia są wysłane"}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <button
                          type="button"
                          className="btn-primary w-full"
                          disabled={uploading || uploadableCount === 0}
                          onClick={uploadSelectedPhotos}
                        >
                          {uploading ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <Send size={18} />
                          )}
                          {uploading
                            ? "Wysyłanie..."
                            : uploadableCount > 0
                              ? `Wyślij ${uploadableCount} ${photoWord(uploadableCount)}`
                              : "Zdjęcia wysłane"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary w-full sm:w-auto"
                          disabled={uploading}
                          onClick={openFilePicker}
                        >
                          <Plus size={18} />
                          Dodaj kolejne
                        </button>
                      </div>
                    </div>

                    <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                      {selectedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[8px] border border-[var(--line)] bg-white p-2"
                        >
                          <img
                            src={photo.previewUrl}
                            alt=""
                            className="h-16 w-16 rounded-[6px] object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#3c2c22]">
                              {photo.file.name}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                              {formatBytes(photo.file.size)}
                            </p>
                            <PhotoProgress photo={photo} />
                          </div>
                          {photo.status === "done" ? (
                            <CheckCircle2 className="text-[#4e5d3e]" size={22} />
                          ) : (
                            <button
                              type="button"
                              className="grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--line)] bg-white text-[#6b4f3c]"
                              disabled={photo.status === "uploading"}
                              onClick={() => removePhoto(photo.id)}
                              title="Usuń zdjęcie"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectionError ? (
                <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-[#8d3e2f]/20 bg-[#8d3e2f]/10 px-3 py-2 text-sm font-bold text-[#7a3529]">
                  <XCircle className="mt-0.5 shrink-0" size={18} />
                  {selectionError}
                </div>
              ) : null}

              {completedCount > 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-[8px] border border-[#6f8056]/20 bg-[#6f8056]/10 px-3 py-3 text-sm font-bold text-[#415033]">
                  <CheckCircle2 size={20} />
                  {activeCount > 0
                    ? `${completedCount} ${photoWord(completedCount)} już dotarło.`
                    : "Zdjęcia dotarły. Dziękujemy!"}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[8px] border border-[var(--line)] bg-white/72 p-5 text-center">
              <Lock className="mx-auto mb-3 text-[#6b4f3c]" />
              <p className="font-bold">Zuzia i Adam zamknęli już przyjmowanie zdjęć.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Galeria wybranych zdjęć będzie dostępna niżej, kiedy zostanie odblokowana.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[#fffaf2]/82 px-4 py-10 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase text-[#6f8056]">Galeria</p>
              <h2 className="font-serif text-4xl">Wybrane zdjęcia</h2>
            </div>
            {event.galleryEnabled ? (
              <span className="status-pill bg-[#6f8056]/12 text-[#4e5d3e]">
                {photos.length} opublikowanych
              </span>
            ) : (
              <span className="status-pill bg-[#8d3e2f]/10 text-[#7a3529]">Jeszcze zamknięta</span>
            )}
          </div>

          {event.galleryEnabled && photos.length ? (
            <div className="guest-gallery-grid">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  className="mb-3 block w-full overflow-hidden rounded-[8px] border border-[var(--line)] bg-white text-left shadow-sm transition hover:brightness-95"
                  onClick={() => setGalleryIndex(index)}
                >
                  <img
                    src={`${galleryUrl}${photo.id}`}
                    alt="Zdjęcie z galerii weselnej"
                    className="h-auto w-full"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/62 px-5 py-8 text-center">
              <p className="font-bold">
                {event.galleryEnabled
                  ? "Galeria jest otwarta, ale nie ma jeszcze opublikowanych zdjęć."
                  : "Po weselu Zuzia i Adam wybiorą zdjęcia i odblokują galerię tutaj."}
              </p>
            </div>
          )}
        </div>
      </section>

      {selectedGalleryPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b130f]/92 p-3">
          <button
            className="absolute right-3 top-3 z-10 grid h-12 w-12 place-items-center rounded-[8px] bg-white/12 text-white backdrop-blur transition hover:bg-white/22"
            onClick={() => setGalleryIndex(null)}
            aria-label="Zamknij podgląd"
          >
            <X size={28} />
          </button>

          {photos.length > 1 ? (
            <>
              <button
                className="absolute left-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-[8px] bg-white/12 text-white backdrop-blur transition hover:bg-white/22"
                onClick={showPreviousPhoto}
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                className="absolute right-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-[8px] bg-white/12 text-white backdrop-blur transition hover:bg-white/22"
                onClick={showNextPhoto}
                aria-label="Następne zdjęcie"
              >
                <ChevronRight size={32} />
              </button>
            </>
          ) : null}

          <img
            src={`${galleryUrl}${selectedGalleryPhoto.id}`}
            alt="Zdjęcie z galerii weselnej"
            className="max-h-[86vh] max-w-full rounded-[8px] object-contain shadow-2xl"
          />

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-4 py-2 text-sm font-bold text-white backdrop-blur">
            {(galleryIndex ?? 0) + 1} / {photos.length}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PhotoProgress({ photo }: { photo: SelectedPhoto }) {
  if (photo.status === "queued") {
    return <p className="mt-1 text-xs font-bold text-[#6f8056]">Gotowe do wysłania</p>;
  }

  if (photo.status === "done") {
    return <p className="mt-1 text-xs font-bold text-[#4e5d3e]">Wysłane</p>;
  }

  if (photo.status === "error") {
    return (
      <p className="mt-1 line-clamp-2 text-xs font-bold text-[#8d3e2f]">
        {photo.error ?? "Nie udało się wysłać."}
      </p>
    );
  }

  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-[#efe4d2]">
        <div
          className="h-full rounded-full bg-[#4e5d3e]"
          style={{ width: `${photo.progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs font-bold text-[#4e5d3e]">Wysyłanie {photo.progress}%</p>
    </div>
  );
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(avif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function parseUploadError(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as { error?: string };
    return parsed.error ?? "Nie udało się wysłać. Spróbuj ponownie.";
  } catch {
    return "Nie udało się wysłać. Spróbuj ponownie.";
  }
}

function photoWord(count: number) {
  if (count === 1) return "zdjęcie";
  if (count >= 2 && count <= 4) return "zdjęcia";
  return "zdjęć";
}

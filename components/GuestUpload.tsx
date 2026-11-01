"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  ImageIcon,
  Loader2,
  Plus,
  Send,
  X,
  RotateCcw,
  Pause,
} from "lucide-react";
import { formatBytes, photoWord } from "@/lib/wedding";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

export default function GuestUpload({
  token,
  enabled,
}: {
  token: string;
  enabled: boolean;
}) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [guestName, setGuestName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const currentPhotos = useRef<SelectedPhoto[]>([]);
  const request = useRef<XMLHttpRequest | null>(null);
  const stop = useRef(false);
  const running = useRef(false);

  const pending = photos.filter(
    (photo) => photo.status === "queued" || photo.status === "error",
  );
  const done = photos.filter((photo) => photo.status === "done").length;
  const errors = photos.filter((photo) => photo.status === "error").length;
  const allDone = photos.length > 0 && done === photos.length;
  const progress = photos.length
    ? Math.round(
        photos.reduce((sum, photo) => sum + photo.progress, 0) / photos.length,
      )
    : 0;

  useEffect(
    () => () => {
      stop.current = true;
      request.current?.abort();
      currentPhotos.current.forEach((photo) =>
        URL.revokeObjectURL(photo.previewUrl),
      );
    },
    [],
  );

  useEffect(() => {
    if (!pending.length && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending.length, uploading]);

  function update(next: SelectedPhoto[]) {
    currentPhotos.current = next;
    setPhotos(next);
  }

  function updatePhoto(id: string, next: Partial<SelectedPhoto>) {
    update(
      currentPhotos.current.map((photo) =>
        photo.id === id ? { ...photo, ...next } : photo,
      ),
    );
  }

  function selectFiles(files: File[]) {
    if (running.current || !enabled) return;
    const accepted: SelectedPhoto[] = [];
    const rejected: string[] = [];
    let duplicates = 0;
    for (const file of files) {
      if (
        !/\.(avif|heic|heif|jpe?g|png|webp)$/i.test(file.name) &&
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
          "image/avif",
        ].includes(file.type)
      ) {
        rejected.push(
          `${file.name}: wybierz zdjęcie JPG, PNG, HEIC, WebP lub AVIF.`,
        );
        continue;
      }
      if (!file.size || file.size > 40 * 1024 * 1024) {
        rejected.push(
          `${file.name}: ${file.size ? "limit to 40 MB na zdjęcie." : "plik jest pusty."}`,
        );
        continue;
      }
      if (
        [...currentPhotos.current, ...accepted].some(
          (photo) =>
            photo.file.name === file.name &&
            photo.file.size === file.size &&
            photo.file.lastModified === file.lastModified,
        )
      ) {
        duplicates += 1;
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      });
    }
    setMessage(
      [
        ...rejected,
        ...(duplicates
          ? [`Pominięto powtórnie wybrane pliki: ${duplicates}.`]
          : []),
      ].join(" "),
    );
    update([...currentPhotos.current, ...accepted]);
  }

  function remove(id: string) {
    if (running.current) return;
    const photo = currentPhotos.current.find((photo) => photo.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    update(currentPhotos.current.filter((photo) => photo.id !== id));
  }

  function clear() {
    currentPhotos.current.forEach((photo) =>
      URL.revokeObjectURL(photo.previewUrl),
    );
    update([]);
    setMessage("");
  }

  async function upload() {
    if (running.current || !pending.length) return;
    running.current = true;
    stop.current = false;
    setUploading(true);
    setStopping(false);
    setMessage("");
    try {
      for (const photo of pending) {
        if (stop.current) break;
        await sendPhoto(photo);
      }
    } finally {
      running.current = false;
      setUploading(false);
      setStopping(false);
    }
  }

  function sendPhoto(photo: SelectedPhoto) {
    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      request.current = xhr;
      xhr.open("POST", `/api/upload/${encodeURIComponent(token)}`);
      xhr.timeout = 180_000;
      updatePhoto(photo.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });
      const data = new FormData();
      data.append("file", photo.file);
      data.append("guestName", guestName.trim());
      const fail = (error: string) => {
        updatePhoto(photo.id, { status: "error", progress: 0, error });
        resolve();
      };
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          updatePhoto(photo.id, {
            progress: Math.min(
              95,
              Math.round((event.loaded / event.total) * 100),
            ),
          });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updatePhoto(photo.id, { status: "done", progress: 100 });
          resolve();
        } else {
          let error = "Nie udało się wysłać zdjęcia. Spróbuj ponownie.";
          try {
            error = JSON.parse(xhr.responseText).error ?? error;
          } catch {
            /* A proxy may return HTML. */
          }
          if (xhr.status === 403) stop.current = true;
          fail(error);
        }
      };
      xhr.onerror = () => {
        stop.current = true;
        fail("Brak połączenia. Zdjęcie czeka na ponowne wysłanie.");
      };
      xhr.ontimeout = () => {
        stop.current = true;
        fail("Wysyłanie trwało zbyt długo. Spróbuj ponownie.");
      };
      xhr.onabort = () => resolve();
      xhr.send(data);
    });
  }

  if (!enabled)
    return (
      <div className="empty-state">
        <ImageIcon size={30} />
        <h2>Dziękujemy za Wasze zdjęcia!</h2>
        <p>Przyjmowanie zdjęć jest już zamknięte.</p>
      </div>
    );

  return (
    <section
      className={`upload-section ${dragging ? "is-dragging" : ""}`}
      aria-label="Dodawanie zdjęć"
      onDragOver={(event) => {
        event.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        selectFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif"
        onChange={(event) => {
          selectFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {allDone ? (
        <div className="upload-success" role="status">
          <CheckCircle2 size={34} />
          <h2>Zdjęcia są już u nas. Dziękujemy!</h2>
          <p>
            Otrzymaliśmy {done} {photoWord(done)}.
          </p>
          <button
            className="btn-secondary"
            onClick={() => {
              clear();
              input.current?.click();
            }}
          >
            <Plus size={19} /> Dodaj kolejne zdjęcia
          </button>
        </div>
      ) : photos.length === 0 ? (
        <div className="upload-start">
          <ImagePlus
            size={34}
            strokeWidth={1.3}
            className="text-[var(--olive)]"
          />
          <h2>Wasze spojrzenie na nasz dzień</h2>
          <button
            className="btn-primary upload-choose"
            onClick={() => input.current?.click()}
          >
            <Plus size={21} /> Wybierz zdjęcia
          </button>
          <p className="file-limit">
            JPG, HEIC, PNG, WebP, AVIF · do 40 MB na zdjęcie
          </p>
        </div>
      ) : (
        <>
          <div className="upload-summary">
            <div>
              <h2>
                {uploading
                  ? `Wysyłanie: ${done} z ${photos.length}`
                  : `Do wysłania: ${pending.length} ${photoWord(pending.length)}`}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {formatBytes(
                  pending.reduce((size, photo) => size + photo.file.size, 0),
                )}
                {done > 0 ? ` · Wysłane: ${done}` : ""}
              </p>
            </div>
            <button
              className="btn-secondary"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <Plus size={18} /> Dodaj kolejne
            </button>
          </div>

          <label className="guest-name">
            <span>
              Twoje imię{" "}
              <span className="font-normal text-[var(--muted)]">
                (opcjonalnie)
              </span>
            </span>
            <input
              autoComplete="given-name"
              maxLength={80}
              value={guestName}
              disabled={uploading}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="np. Ania"
            />
          </label>

          <ul className="upload-list" aria-label="Wybrane zdjęcia">
            {photos.map((photo) => (
              <li key={photo.id} className="upload-row">
                <UploadPreview photo={photo} />
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    title={photo.file.name}
                  >
                    {photo.file.name}
                  </p>
                  <p
                    className={`mt-1 text-sm ${photo.status === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
                  >
                    {photo.status === "done"
                      ? "Wysłane"
                      : photo.status === "error"
                        ? photo.error
                        : photo.status === "uploading"
                          ? photo.progress >= 95
                            ? "Zapisywanie zdjęcia..."
                            : `Wysyłanie ${photo.progress}%`
                          : formatBytes(photo.file.size)}
                  </p>
                </div>
                {photo.status === "done" ? (
                  <CheckCircle2
                    size={21}
                    className="justify-self-center text-[var(--olive)]"
                    aria-label="Wysłane"
                  />
                ) : (
                  <button
                    className="icon-button"
                    disabled={uploading}
                    onClick={() => remove(photo.id)}
                    aria-label={`Usuń ${photo.file.name}`}
                    title="Usuń zdjęcie"
                  >
                    <X size={19} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="upload-actions">
            {uploading && (
              <progress
                className="upload-progress"
                value={progress}
                max={100}
                aria-label="Postęp wysyłania"
              />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn-primary grow"
                disabled={uploading || !pending.length}
                onClick={upload}
              >
                {uploading ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : errors && errors === pending.length ? (
                  <RotateCcw size={19} />
                ) : (
                  <Send size={19} />
                )}
                {uploading
                  ? stopping
                    ? "Kończenie bieżącego zdjęcia..."
                    : "Wysyłanie..."
                  : errors && errors === pending.length
                    ? `Ponów wysyłanie (${pending.length})`
                    : `Wyślij ${pending.length} ${photoWord(pending.length)}`}
              </button>
              {uploading ? (
                <button
                  className="btn-secondary"
                  disabled={stopping}
                  onClick={() => {
                    stop.current = true;
                    setStopping(true);
                  }}
                >
                  <Pause size={18} /> Zatrzymaj
                </button>
              ) : (
                <button className="text-button" onClick={clear}>
                  Wyczyść wybór
                </button>
              )}
            </div>
            <p className="sr-only" role="status">
              Wysłane zdjęcia: {done} z {photos.length}.
              {errors ? ` Błędy: ${errors}.` : ""}
            </p>
          </div>
        </>
      )}
      {message && (
        <p className="notice mt-4" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function UploadPreview({ photo }: { photo: SelectedPhoto }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="upload-preview">
      {failed ? (
        <ImageIcon aria-label="Zdjęcie bez podglądu" size={22} />
      ) : (
        <img src={photo.previewUrl} alt="" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

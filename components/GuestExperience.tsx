"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import Polish from "@uppy/locales/lib/pl_PL";
import { CheckCircle2, Heart, Lock } from "lucide-react";
import type { EventDto, PhotoDto } from "@/lib/photo-dto";

type Props = {
  event: EventDto;
  photos: PhotoDto[];
  token: string;
};

const guestUploadLocale = {
  ...Polish,
  strings: {
    ...Polish.strings,
    browse: "Wybierz zdjęcia",
    browseFiles: "Wybierz zdjęcia z telefonu",
    dropHint: "Dodaj zdjęcia z telefonu",
    dropPasteFiles: "%{browse}",
    dropPasteBoth: "%{browse}",
    uploadXFiles: {
      "0": "Wyślij %{smart_count} zdjęcie",
      "1": "Wyślij %{smart_count} zdjęć",
    },
    uploadXNewFiles: {
      "0": "Wyślij +%{smart_count} zdjęcie",
      "1": "Wyślij +%{smart_count} zdjęć",
    },
    xFilesSelected: {
      "0": "%{smart_count} zdjęcie wybrane",
      "1": "%{smart_count} zdjęć wybranych",
    },
  },
};

export default function GuestExperience({ event, photos, token }: Props) {
  const [guestName, setGuestName] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const galleryUrl = `/api/gallery/${token}/photos/`;

  const uppy = useMemo(() => {
    return new Uppy({
      locale: guestUploadLocale,
      restrictions: {
        maxFileSize: 40 * 1024 * 1024,
        maxNumberOfFiles: 80,
        allowedFileTypes: ["image/*", ".heic", ".heif"],
      },
      autoProceed: false,
    }).use(XHRUpload, {
      endpoint: `/api/upload/${event.uploadToken}`,
      fieldName: "file",
      formData: true,
      allowedMetaFields: ["guestName"],
      limit: 2,
      getResponseData: (xhr) => JSON.parse(xhr.responseText) as Record<string, unknown>,
    });
  }, [event.uploadToken]);

  useEffect(() => {
    uppy.setMeta({ guestName: guestName.trim() });
  }, [guestName, uppy]);

  useEffect(() => {
    const onComplete = () => {
      const successful = uppy.getFiles().filter((file) => file.progress.uploadComplete);
      setCompletedCount(successful.length);
    };

    uppy.on("complete", onComplete);
    return () => {
      uppy.off("complete", onComplete);
      uppy.destroy();
    };
  }, [uppy]);

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

              <Dashboard
                uppy={uppy}
                width="100%"
                height={280}
                proudlyDisplayPoweredByUppy={false}
                note="Możesz wybrać kilka zdjęć naraz."
              />

              {completedCount > 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-[8px] border border-[#6f8056]/20 bg-[#6f8056]/10 px-3 py-3 text-sm font-bold text-[#415033]">
                  <CheckCircle2 size={20} />
                  Zdjęcia dotarły. Dziękujemy!
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
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={`${galleryUrl}${photo.id}`}
                  target="_blank"
                  className="mb-3 block overflow-hidden rounded-[8px] border border-[var(--line)] bg-white shadow-sm"
                >
                  <img
                    src={`${galleryUrl}${photo.id}`}
                    alt="Zdjęcie z galerii weselnej"
                    className="h-auto w-full"
                    loading="lazy"
                  />
                </a>
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
    </main>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Check, Download, Images, Loader2, Lock, X } from "lucide-react";
import type { GalleryPage } from "@/lib/gallery";
import { photoWord } from "@/lib/wedding";
import PhotoViewer from "@/components/PhotoViewer";
import DownloadArchive from "@/components/DownloadArchive";

export default function GuestGallery({
  token,
  enabled,
  initialPage,
}: {
  token: string;
  enabled: boolean;
  initialPage: GalleryPage;
}) {
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const root = `/api/gallery/${encodeURIComponent(token)}`;

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function loadMore() {
    if (loading || !page.nextCursor) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${root}/photos?cursor=${encodeURIComponent(page.nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          "Nie udało się wczytać kolejnych zdjęć. Spróbuj ponownie.",
        );
      const next = (await response.json()) as GalleryPage;
      setPage((current) => ({
        ...next,
        photos: [
          ...current.photos,
          ...next.photos.filter(
            (photo) => !current.photos.some((old) => old.id === photo.id),
          ),
        ],
      }));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Sprawdź połączenie i spróbuj ponownie.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!enabled)
    return (
      <div className="empty-state">
        <Lock size={28} strokeWidth={1.4} />
        <h2>Wspomnienia jeszcze się zbierają</h2>
        <p>Po weselu wybierzemy zdjęcia i otworzymy dla Was galerię.</p>
      </div>
    );
  if (!page.photos.length)
    return (
      <div className="empty-state">
        <Images size={30} strokeWidth={1.4} />
        <h2>Tu pojawią się nasze wspomnienia</h2>
        <p>Pierwsze wybrane zdjęcia dodamy już niedługo.</p>
      </div>
    );

  return (
    <section className="gallery-section" aria-label="Galeria weselna">
      <div className="gallery-toolbar">
        <div>
          <h2>Nasz dzień w Waszych kadrach</h2>
          <p>
            {page.total} {photoWord(page.total)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? <X size={18} /> : <Check size={18} />}
            {selecting ? "Anuluj wybór" : "Wybierz zdjęcia"}
          </button>
          {!selecting && (
            <DownloadArchive endpoint={`${root}/download`}>
              Pobierz całość
            </DownloadArchive>
          )}
        </div>
      </div>
      {selecting && (
        <div className="selection-bar">
          <span aria-live="polite">Zaznaczono: {selected.length}</span>
          <button
            className="text-button"
            onClick={() =>
              setSelected(
                selected.length === page.photos.length
                  ? []
                  : page.photos.map((photo) => photo.id),
              )
            }
          >
            {selected.length === page.photos.length
              ? "Odznacz wszystkie"
              : "Zaznacz widoczne"}
          </button>
          <DownloadArchive
            endpoint={`${root}/download`}
            ids={selected}
            disabled={!selected.length}
          >
            Pobierz wybrane ({selected.length})
          </DownloadArchive>
        </div>
      )}
      <div className="guest-gallery-grid">
        {page.photos.map((photo, index) => (
          <article
            key={photo.id}
            className={`gallery-photo ${selected.includes(photo.id) ? "is-selected" : ""}`}
          >
            <button
              className="gallery-image"
              onClick={() => (selecting ? toggle(photo.id) : setViewer(index))}
              aria-label={
                selecting
                  ? `Wybierz zdjęcie ${index + 1}`
                  : `Otwórz zdjęcie ${index + 1}`
              }
              aria-pressed={selecting ? selected.includes(photo.id) : undefined}
            >
              <img
                src={`${root}/photos/${photo.id}?variant=thumb&v=${encodeURIComponent(photo.updatedAt)}`}
                alt={`Zdjęcie z wesela ${index + 1}`}
                loading="lazy"
              />
              {selecting && (
                <span className="photo-checkbox" aria-hidden="true">
                  {selected.includes(photo.id) && <Check size={17} />}
                </span>
              )}
            </button>
            <div className="gallery-caption">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <a
                className="icon-button"
                href={`${root}/photos/${photo.id}?download=1`}
                download
                aria-label={`Pobierz zdjęcie ${index + 1}`}
                title="Pobierz zdjęcie"
              >
                <Download size={18} />
              </a>
            </div>
          </article>
        ))}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {page.nextCursor && (
        <div className="mt-8 text-center">
          <button
            className="btn-secondary"
            disabled={loading}
            onClick={loadMore}
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Wczytywanie..." : "Pokaż kolejne zdjęcia"}
          </button>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {page.photos.length} z {page.total}
          </p>
        </div>
      )}
      {viewer !== null && (
        <PhotoViewer
          initialIndex={viewer}
          onClose={() => setViewer(null)}
          photos={page.photos.map((photo, index) => ({
            id: photo.id,
            src: `${root}/photos/${photo.id}?v=${encodeURIComponent(photo.updatedAt)}`,
            downloadUrl: `${root}/photos/${photo.id}?download=1`,
            label: `Wspomnienie ${index + 1}`,
          }))}
        />
      )}
    </section>
  );
}

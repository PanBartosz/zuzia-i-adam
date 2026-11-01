"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Loader2,
  X,
} from "lucide-react";

export type ViewerPhoto = {
  id: string;
  src: string;
  downloadUrl: string;
  label: string;
};

export default function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: ViewerPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[index];

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const overscroll = document.documentElement.style.overscrollBehavior;
    element?.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      document.documentElement.style.overscrollBehavior = overscroll;
      previousFocus?.focus();
    };
  }, []);

  function move(direction: number) {
    setIndex(
      (current) => (current + direction + photos.length) % photos.length,
    );
  }

  if (!photo) return null;

  return (
    <dialog
      ref={dialog}
      className="photo-viewer"
      aria-label="Podgląd zdjęć"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <header className="viewer-header">
        <p aria-live="polite">
          {index + 1} <span className="text-white/60">/ {photos.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <a className="viewer-download" href={photo.downloadUrl} download>
            <Download size={19} /> Pobierz
          </a>
          <button
            className="icon-button viewer-button"
            onClick={onClose}
            aria-label="Zamknij podgląd"
            title="Zamknij podgląd"
            autoFocus
          >
            <X size={24} />
          </button>
        </div>
      </header>
      <div
        className="viewer-stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          touchStart.current =
            event.touches.length === 1
              ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
              : null;
        }}
        onTouchEnd={(event) => {
          if (!touchStart.current) return;
          const dx = event.changedTouches[0].clientX - touchStart.current.x;
          const dy = event.changedTouches[0].clientY - touchStart.current.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
            move(dx < 0 ? 1 : -1);
          touchStart.current = null;
        }}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        <ViewerImage key={photo.src} photo={photo} />
      </div>
      <footer className="viewer-footer">
        <button
          className="icon-button viewer-button"
          onClick={() => move(-1)}
          disabled={photos.length < 2}
          aria-label="Poprzednie zdjęcie"
          title="Poprzednie zdjęcie"
        >
          <ChevronLeft />
        </button>
        <p className="min-w-0 truncate text-sm text-white/75">{photo.label}</p>
        <button
          className="icon-button viewer-button"
          onClick={() => move(1)}
          disabled={photos.length < 2}
          aria-label="Następne zdjęcie"
          title="Następne zdjęcie"
        >
          <ChevronRight />
        </button>
      </footer>
    </dialog>
  );
}

function ViewerImage({ photo }: { photo: ViewerPhoto }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {loading && (
        <Loader2
          className="absolute animate-spin text-white/70"
          aria-label="Wczytywanie zdjęcia"
        />
      )}
      {failed ? (
        <p className="flex items-center gap-3 text-white" role="alert">
          <ImageOff /> Nie udało się wczytać zdjęcia.
        </p>
      ) : (
        <img
          src={photo.src}
          alt={photo.label}
          draggable={false}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
    </>
  );
}

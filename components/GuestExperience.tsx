"use client";

import { useState } from "react";
import { Camera, Images, Heart } from "lucide-react";
import type { EventDto } from "@/lib/photo-dto";
import type { GalleryPage } from "@/lib/gallery";
import { coupleName, weddingMessage } from "@/lib/wedding";
import GuestUpload from "@/components/GuestUpload";
import GuestGallery from "@/components/GuestGallery";

export default function GuestExperience({
  event,
  gallery,
  token,
}: {
  event: EventDto;
  gallery: GalleryPage;
  token: string;
}) {
  const [view, setView] = useState<"upload" | "gallery">(
    token === event.galleryToken ||
      (!event.uploadEnabled && event.galleryEnabled)
      ? "gallery"
      : "upload",
  );
  const views = ["upload", "gallery"] as const;

  return (
    <main className="guest-page">
      <header className="guest-masthead">
        <span className="font-serif text-xl">
          Z <span className="text-[var(--olive)]">&</span> A
        </span>
        <span className="text-sm text-[var(--muted)]">
          {event.weddingDate
            ? new Intl.DateTimeFormat("pl-PL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Warsaw",
              }).format(new Date(event.weddingDate))
            : "Nasz dzień. Wasze wspomnienia."}
        </span>
      </header>
      <div className="guest-intro">
        <Heart
          size={19}
          strokeWidth={1.3}
          className="mx-auto mb-5 text-[var(--olive)]"
          aria-hidden="true"
        />
        <h1>{coupleName}</h1>
        <p>{weddingMessage}</p>
      </div>
      <div className="guest-tabs" role="tablist" aria-label="Zdjęcia weselne">
        {views.map((item, index) => (
          <button
            key={item}
            id={`tab-${item}`}
            role="tab"
            aria-selected={view === item}
            aria-controls={`panel-${item}`}
            tabIndex={view === item ? 0 : -1}
            onClick={() => setView(item)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "upload"
                    : event.key === "End"
                      ? "gallery"
                      : views[1 - index];
                setView(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            {item === "upload" ? <Camera size={19} /> : <Images size={19} />}
            {item === "upload" ? "Dodaj zdjęcia" : "Galeria"}
          </button>
        ))}
      </div>
      <div
        id="panel-upload"
        role="tabpanel"
        aria-labelledby="tab-upload"
        hidden={view !== "upload"}
      >
        <GuestUpload token={event.uploadToken} enabled={event.uploadEnabled} />
      </div>
      <div
        id="panel-gallery"
        role="tabpanel"
        aria-labelledby="tab-gallery"
        hidden={view !== "gallery"}
      >
        <GuestGallery
          token={token}
          enabled={event.galleryEnabled}
          initialPage={gallery}
        />
      </div>
      <footer className="guest-footer">
        <span className="font-serif">Zuzanna & Adam</span>
        <Heart size={13} strokeWidth={1.5} />
        <span>Dobrze, że jesteście.</span>
      </footer>
    </main>
  );
}

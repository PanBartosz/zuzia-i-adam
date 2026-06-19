"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CheckCircle2,
  Crop,
  Download,
  Eye,
  EyeOff,
  ImageIcon,
  Lock,
  LogOut,
  Pencil,
  QrCode,
  RefreshCw,
  Settings,
  Unlock,
  X,
} from "lucide-react";
import type { EventDto, PhotoDto } from "@/lib/photo-dto";

type Props = {
  event: EventDto;
  initialPhotos: PhotoDto[];
  appBaseUrl: string;
  sessionEmail: string;
};

type AdminTab = "photos" | "gallery" | "qr" | "settings";
type FilterStatus = PhotoDto["status"] | "ALL";

const statusLabels: Record<PhotoDto["status"], string> = {
  NEW: "Nowe",
  SELECTED: "Wybrane",
  PUBLISHED: "Opublikowane",
  HIDDEN: "Ukryte",
  REJECTED: "Odrzucone",
};

const statusClasses: Record<PhotoDto["status"], string> = {
  NEW: "bg-[#d8bd85]/18 text-[#6b4f3c]",
  SELECTED: "bg-[#b46f47]/12 text-[#8a4d31]",
  PUBLISHED: "bg-[#6f8056]/14 text-[#405034]",
  HIDDEN: "bg-[#75614f]/12 text-[#5c4a3b]",
  REJECTED: "bg-[#8d3e2f]/10 text-[#7a3529]",
};

export default function AdminDashboard({
  event,
  initialPhotos,
  appBaseUrl,
  sessionEmail,
}: Props) {
  const [eventState, setEventState] = useState(event);
  const [photos, setPhotos] = useState(initialPhotos);
  const [tab, setTab] = useState<AdminTab>("photos");
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [cropPhoto, setCropPhoto] = useState<PhotoDto | null>(null);
  const [notice, setNotice] = useState("");

  const filteredPhotos = useMemo(() => {
    if (filter === "ALL") return photos;
    return photos.filter((photo) => photo.status === filter);
  }, [filter, photos]);

  const counts = useMemo(() => {
    return photos.reduce(
      (acc, photo) => {
        acc.ALL += 1;
        acc[photo.status] += 1;
        return acc;
      },
      {
        ALL: 0,
        NEW: 0,
        SELECTED: 0,
        PUBLISHED: 0,
        HIDDEN: 0,
        REJECTED: 0,
      } satisfies Record<FilterStatus, number>,
    );
  }, [photos]);

  const uploadUrl = `${appBaseUrl.replace(/\/$/, "")}/u/${eventState.uploadToken}`;
  const galleryUrl = `${appBaseUrl.replace(/\/$/, "")}/u/${eventState.galleryToken}`;

  async function refreshPhotos() {
    const response = await fetch("/api/admin/photos", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { photos: PhotoDto[] };
    setPhotos(body.photos);
  }

  async function updatePhoto(id: string, action: string) {
    setBusyPhotoId(id);
    setNotice("");

    const response = await fetch(`/api/admin/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    setBusyPhotoId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setNotice(body?.error ?? "Nie udało się zaktualizować zdjęcia.");
      return;
    }

    const body = (await response.json()) as { photo: PhotoDto };
    setPhotos((current) =>
      current.map((photo) => (photo.id === body.photo.id ? body.photo : photo)),
    );
  }

  async function updateSettings(next: Partial<Pick<EventDto, "uploadEnabled" | "galleryEnabled">>) {
    const response = await fetch("/api/admin/event", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    if (!response.ok) {
      setNotice("Nie udało się zapisać ustawień.");
      return;
    }

    const body = (await response.json()) as { event: EventDto };
    setEventState(body.event);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="min-h-screen bg-[#f7f1e7]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#fffaf2]/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-black uppercase text-[#6f8056]">Panel weselny</p>
            <h1 className="font-serif text-4xl leading-none">{eventState.coupleName}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusToggle
              enabled={eventState.uploadEnabled}
              iconOn={<Unlock size={17} />}
              iconOff={<Lock size={17} />}
              labelOn="Upload otwarty"
              labelOff="Upload zamknięty"
              onClick={() => updateSettings({ uploadEnabled: !eventState.uploadEnabled })}
            />
            <StatusToggle
              enabled={eventState.galleryEnabled}
              iconOn={<Eye size={17} />}
              iconOff={<EyeOff size={17} />}
              labelOn="Galeria otwarta"
              labelOff="Galeria zamknięta"
              onClick={() => updateSettings({ galleryEnabled: !eventState.galleryEnabled })}
            />
            <button className="btn-secondary" onClick={logout}>
              <LogOut size={17} />
              {sessionEmail}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-2">
          <TabButton active={tab === "photos"} onClick={() => setTab("photos")}>
            <ImageIcon size={17} />
            Zdjęcia
          </TabButton>
          <TabButton active={tab === "gallery"} onClick={() => setTab("gallery")}>
            <Eye size={17} />
            Galeria
          </TabButton>
          <TabButton active={tab === "qr"} onClick={() => setTab("qr")}>
            <QrCode size={17} />
            QR
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            <Settings size={17} />
            Ustawienia
          </TabButton>
        </nav>

        {notice ? (
          <div className="mb-4 rounded-[8px] border border-[#8d3e2f]/20 bg-[#8d3e2f]/10 px-4 py-3 text-sm font-bold text-[#7a3529]">
            {notice}
          </div>
        ) : null}

        {tab === "photos" ? (
          <section>
            <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-2">
                {(["ALL", "NEW", "SELECTED", "PUBLISHED", "HIDDEN", "REJECTED"] as const).map(
                  (status) => (
                    <button
                      key={status}
                      className={`rounded-[8px] border px-3 py-2 text-sm font-black ${
                        filter === status
                          ? "border-[#4e5d3e] bg-[#4e5d3e] text-white"
                          : "border-[var(--line)] bg-white/72 text-[#4e3a2d]"
                      }`}
                      onClick={() => setFilter(status)}
                    >
                      {status === "ALL" ? "Wszystkie" : statusLabels[status]} {counts[status]}
                    </button>
                  ),
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={refreshPhotos}>
                  <RefreshCw size={17} />
                  Odśwież
                </button>
                <a className="btn-primary" href={`/api/admin/download?status=${filter}`}>
                  <Download size={17} />
                  Pobierz ZIP
                </a>
              </div>
            </div>

            <PhotoGrid
              photos={filteredPhotos}
              busyPhotoId={busyPhotoId}
              onAction={updatePhoto}
              onCrop={setCropPhoto}
            />
          </section>
        ) : null}

        {tab === "gallery" ? (
          <section>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase text-[#6f8056]">
                  Zdjęcia widoczne dla gości
                </p>
                <h2 className="font-serif text-4xl">Publiczna galeria</h2>
              </div>
              <a className="btn-secondary" href={galleryUrl} target="_blank">
                <Eye size={17} />
                Podgląd
              </a>
            </div>
            <PhotoGrid
              photos={photos.filter((photo) => photo.status === "PUBLISHED")}
              busyPhotoId={busyPhotoId}
              onAction={updatePhoto}
              onCrop={setCropPhoto}
            />
          </section>
        ) : null}

        {tab === "qr" ? (
          <section>
            <div className="mb-6">
              <p className="text-xs font-black uppercase text-[#6f8056]">Do druku</p>
              <h2 className="font-serif text-4xl">Kody QR</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <QrCard title="Dodawanie zdjęć" subtitle="Postaw na stolikach i przy parkiecie" url={uploadUrl} />
              <QrCard title="Galeria po weselu" subtitle="Ten kod może trafić do wiadomości dla gości" url={galleryUrl} />
            </div>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="paper-surface rounded-[8px] border border-[var(--line)] p-5">
              <h2 className="font-serif text-3xl">Dostęp</h2>
              <div className="mt-5 grid gap-3">
                <SettingRow
                  title="Wrzucanie zdjęć przez gości"
                  description="Po zamknięciu kod QR nadal działa, ale formularz nie przyjmuje plików."
                  enabled={eventState.uploadEnabled}
                  onClick={() => updateSettings({ uploadEnabled: !eventState.uploadEnabled })}
                />
                <SettingRow
                  title="Oglądanie galerii przez gości"
                  description="Goście zobaczą tylko zdjęcia oznaczone jako opublikowane."
                  enabled={eventState.galleryEnabled}
                  onClick={() => updateSettings({ galleryEnabled: !eventState.galleryEnabled })}
                />
              </div>
            </div>

            <div className="paper-surface rounded-[8px] border border-[var(--line)] p-5">
              <h2 className="font-serif text-3xl">Adresy</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="font-black uppercase text-[#6f8056]">Upload</dt>
                  <dd className="mt-1 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3">
                    {uploadUrl}
                  </dd>
                </div>
                <div>
                  <dt className="font-black uppercase text-[#6f8056]">Galeria</dt>
                  <dd className="mt-1 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3">
                    {galleryUrl}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}
      </div>

      {cropPhoto ? (
        <CropModal
          photo={cropPhoto}
          onClose={() => setCropPhoto(null)}
          onSaved={(updated) => {
            setPhotos((current) =>
              current.map((photo) => (photo.id === updated.id ? updated : photo)),
            );
            setCropPhoto(null);
          }}
        />
      ) : null}
    </main>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-black ${
        active
          ? "border-[#4e5d3e] bg-[#4e5d3e] text-white"
          : "border-[var(--line)] bg-white/72 text-[#4e3a2d]"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatusToggle({
  enabled,
  labelOn,
  labelOff,
  iconOn,
  iconOff,
  onClick,
}: {
  enabled: boolean;
  labelOn: string;
  labelOff: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-black ${
        enabled ? "bg-[#6f8056] text-white" : "bg-[#8d3e2f] text-white"
      }`}
      onClick={onClick}
    >
      {enabled ? iconOn : iconOff}
      {enabled ? labelOn : labelOff}
    </button>
  );
}

function PhotoGrid({
  photos,
  busyPhotoId,
  onAction,
  onCrop,
}: {
  photos: PhotoDto[];
  busyPhotoId: string | null;
  onAction: (id: string, action: string) => void;
  onCrop: (photo: PhotoDto) => void;
}) {
  if (!photos.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/58 px-5 py-12 text-center">
        <ImageIcon className="mx-auto mb-3 text-[#6f8056]" size={32} />
        <p className="font-bold">Nie ma tu jeszcze zdjęć.</p>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <article
          key={photo.id}
          className="overflow-hidden rounded-[8px] border border-[var(--line)] bg-[#fffaf2] shadow-sm"
        >
          <button
            className="block aspect-square w-full bg-[#efe4d2]"
            onClick={() => onCrop(photo)}
            title="Kadruj zdjęcie"
          >
            <img
              src={`/api/admin/photos/${photo.id}/file?variant=thumb&v=${encodeURIComponent(
                photo.updatedAt,
              )}`}
              alt={photo.originalName ?? "Zdjęcie weselne"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={`status-pill ${statusClasses[photo.status]}`}>
                {statusLabels[photo.status]}
              </span>
              {photo.guestName ? (
                <span className="truncate text-xs font-bold text-[var(--muted)]">
                  {photo.guestName}
                </span>
              ) : null}
            </div>

            {photo.error ? (
              <p className="mb-2 line-clamp-2 text-xs font-semibold text-[#8d3e2f]">
                Miniatura zastępcza: {photo.error}
              </p>
            ) : null}

            <div className="space-y-2">
              {photo.status === "PUBLISHED" ? (
                <div className="flex items-center gap-2 rounded-[8px] bg-[#6f8056]/12 px-3 py-2 text-sm font-black text-[#405034]">
                  <CheckCircle2 size={17} />
                  Widoczne w galerii
                </div>
              ) : (
                <button
                  className="btn-primary min-h-10 w-full px-3 py-2 text-sm"
                  disabled={busyPhotoId === photo.id}
                  onClick={() => onAction(photo.id, "publish")}
                >
                  <Eye size={17} />
                  Opublikuj w galerii
                </button>
              )}

              {photo.status === "PUBLISHED" ? (
                <button
                  className="btn-secondary min-h-10 w-full px-3 py-2 text-sm"
                  disabled={busyPhotoId === photo.id}
                  onClick={() => onAction(photo.id, "unpublish")}
                >
                  <EyeOff size={17} />
                  Cofnij publikację
                </button>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-secondary min-h-10 px-3 py-2 text-sm"
                  onClick={() => onCrop(photo)}
                >
                  <Crop size={17} />
                  {photo.crop ? "Popraw kadr" : "Kadruj"}
                </button>
                <a
                  className="btn-secondary min-h-10 px-3 py-2 text-sm"
                  href={`/api/admin/photos/${photo.id}/file?variant=original&download=1`}
                >
                  <Download size={17} />
                  Pobierz
                </a>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-[#6f8056]">
                  Status roboczy
                </span>
                <select
                  className="focus-ring h-10 w-full rounded-[8px] border border-[var(--line)] bg-white px-2 text-sm font-bold text-[#3c2c22]"
                  value={photo.status}
                  disabled={busyPhotoId === photo.id}
                  onChange={(event) =>
                    onAction(photo.id, statusToAction(event.target.value as PhotoDto["status"]))
                  }
                >
                  <option value="NEW">Nowe</option>
                  <option value="SELECTED">Wybrane</option>
                  <option value="PUBLISHED">Opublikowane</option>
                  <option value="HIDDEN">Ukryte</option>
                  <option value="REJECTED">Odrzucone</option>
                </select>
              </label>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function statusToAction(status: PhotoDto["status"]) {
  if (status === "SELECTED") return "select";
  if (status === "PUBLISHED") return "publish";
  if (status === "HIDDEN") return "hide";
  if (status === "REJECTED") return "reject";
  return "new";
}

function QrCard({ title, subtitle, url }: { title: string; subtitle: string; url: string }) {
  const qrRef = useRef<SVGSVGElement>(null);

  function downloadSvg() {
    if (!qrRef.current) return;
    const source = new XMLSerializer().serializeToString(qrRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-zuzia-adam.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="paper-surface rounded-[8px] border border-[var(--line)] p-5">
      <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
        <div className="rounded-[8px] border border-[var(--line)] bg-white p-4">
          <QRCodeSVG ref={qrRef} value={url} size={190} marginSize={2} />
        </div>
        <div>
          <p className="font-serif text-3xl">{title}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
          <p className="mt-4 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3 text-sm">
            {url}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={downloadSvg}>
              <Download size={17} />
              Pobierz SVG
            </button>
            <a className="btn-secondary" href={url} target="_blank">
              <Eye size={17} />
              Otwórz
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-[var(--line)] bg-white/70 p-4">
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </div>
      <button
        className={`inline-flex min-h-10 min-w-24 items-center justify-center rounded-[8px] px-3 text-sm font-black text-white ${
          enabled ? "bg-[#6f8056]" : "bg-[#8d3e2f]"
        }`}
        onClick={onClick}
      >
        {enabled ? "Włączone" : "Wyłączone"}
      </button>
    </div>
  );
}

function CropModal({
  photo,
  onClose,
  onSaved,
}: {
  photo: PhotoDto;
  onClose: () => void;
  onSaved: (photo: PhotoDto) => void;
}) {
  const [crop, setCrop] = useState<Point>(photo.crop?.point ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(photo.crop?.zoom ?? 1);
  const [area, setArea] = useState<Area | null>(photo.crop?.area ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!area) return;
    setSaving(true);
    setError("");

    const response = await fetch(`/api/admin/photos/${photo.id}/crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop: area, zoom, point: crop }),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Nie udało się zapisać kadru.");
      return;
    }

    const body = (await response.json()) as { photo: PhotoDto };
    onSaved(body.photo);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f1712]/70 p-3">
      <div className="w-full max-w-4xl overflow-hidden rounded-[8px] bg-[#fffaf2] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase text-[#6f8056]">Kadrowanie</p>
            <h2 className="font-serif text-3xl">
              {photo.crop ? "Popraw kadr" : "Wersja do galerii"}
            </h2>
          </div>
          <button className="btn-secondary" onClick={onClose}>
            <X size={17} />
            Zamknij
          </button>
        </div>

        <div className="relative h-[58vh] min-h-[360px] bg-[#2a211b]">
          <Cropper
            image={`/api/admin/photos/${photo.id}/file?variant=web&v=${encodeURIComponent(
              photo.updatedAt,
            )}`}
            crop={crop}
            zoom={zoom}
            aspect={4 / 3}
            initialCroppedAreaPixels={photo.crop?.area}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) => setArea(croppedAreaPixels)}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-1 items-center gap-3">
            <span className="text-sm font-black">Zoom</span>
            <input
              className="w-full accent-[#6f8056]"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {error ? <p className="self-center text-sm font-bold text-[#8d3e2f]">{error}</p> : null}
            <button className="btn-primary" onClick={save} disabled={saving}>
              {photo.crop ? <Pencil size={17} /> : <Check size={17} />}
              {saving ? "Zapisywanie..." : photo.crop ? "Zapisz korektę" : "Zapisz i publikuj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

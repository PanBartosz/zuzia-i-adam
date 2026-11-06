"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
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
import PhotoViewer from "@/components/PhotoViewer";
import DownloadArchive from "@/components/DownloadArchive";
import { coupleName } from "@/lib/wedding";

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
  NEW: "bg-[#b8c5b6]/18 text-[#59665c]",
  SELECTED: "bg-[#ac8d91]/12 text-[#73555d]",
  PUBLISHED: "bg-[#62775e]/14 text-[#465e49]",
  HIDDEN: "bg-[#777f79]/12 text-[#59665c]",
  REJECTED: "bg-[#a13e46]/10 text-[#8b3540]",
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    photos: PhotoDto[];
    index: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const filteredPhotos = useMemo(() => {
    if (filter === "ALL") return photos;
    return photos.filter((photo) => photo.status === filter);
  }, [filter, photos]);
  const visiblePhotos = filteredPhotos.slice(0, visibleCount);
  const publishedPhotos = photos.filter(
    (photo) => photo.status === "PUBLISHED",
  );

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

  const uploadUrl = `${appBaseUrl.replace(/\/$/, "")}/u/${encodeURIComponent(eventState.uploadToken)}`;
  const galleryUrl = `${appBaseUrl.replace(/\/$/, "")}/u/${encodeURIComponent(eventState.galleryToken)}`;

  async function refreshPhotos() {
    setRefreshing(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/photos", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { photos: PhotoDto[] };
      setPhotos(body.photos);
      setSelectedIds((current) =>
        current.filter((id) => body.photos.some((photo) => photo.id === id)),
      );
    } catch {
      setNotice("Nie udało się odświeżyć zdjęć. Sprawdź połączenie.");
    } finally {
      setRefreshing(false);
    }
  }

  async function updatePhoto(id: string, action: string) {
    if (busyPhotoId) return;
    setBusyPhotoId(id);
    setNotice("");
    const previous = photos.find((photo) => photo.id === id);
    const nextStatus: Record<string, PhotoDto["status"]> = {
      publish: "PUBLISHED",
      unpublish: "SELECTED",
      select: "SELECTED",
      hide: "HIDDEN",
      reject: "REJECTED",
      new: "NEW",
    };
    if (nextStatus[action])
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id ? { ...photo, status: nextStatus[action] } : photo,
        ),
      );

    try {
      const response = await fetch(`/api/admin/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Nie udało się zaktualizować zdjęcia.");
      }

      const body = (await response.json()) as { photo: PhotoDto };
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === body.photo.id ? body.photo : photo,
        ),
      );
    } catch (error) {
      if (previous)
        setPhotos((current) =>
          current.map((photo) => (photo.id === id ? previous : photo)),
        );
      setNotice(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać zmiany. Spróbuj ponownie.",
      );
    } finally {
      setBusyPhotoId(null);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function switchTab(next: AdminTab) {
    setTab(next);
    setSelectedIds([]);
    setVisibleCount(48);
  }

  async function updateSettings(
    next: Partial<Pick<EventDto, "uploadEnabled" | "galleryEnabled">> & { rotateAccess?: boolean },
  ) {
    if (settingsBusy) return;
    setSettingsBusy(true);
    setNotice("");
    try {
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
      if (next.rotateAccess) setNotice("Nowe kody są gotowe. Poprzednie kody, linki i QR zostały unieważnione.");
    } catch {
      setNotice("Nie udało się zapisać ustawień. Sprawdź połączenie.");
    } finally {
      setSettingsBusy(false);
    }
  }

  function rotateAccess() {
    if (settingsBusy || !window.confirm("Wygenerować nowe kody dostępu? Dotychczasowe kody, linki i wydrukowane QR przestaną działać.")) return;
    void updateSettings({ rotateAccess: true });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <main className="min-h-screen bg-[var(--paper-deep)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase text-[#62775e]">
              Panel weselny
            </p>
            <h1 className="font-serif text-3xl leading-tight">{coupleName}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusToggle
              disabled={settingsBusy}
              enabled={eventState.uploadEnabled}
              iconOn={<Unlock size={17} />}
              iconOff={<Lock size={17} />}
              labelOn="Dodawanie otwarte"
              labelOff="Dodawanie zamknięte"
              onClick={() =>
                updateSettings({ uploadEnabled: !eventState.uploadEnabled })
              }
            />
            <StatusToggle
              disabled={settingsBusy}
              enabled={eventState.galleryEnabled}
              iconOn={<Eye size={17} />}
              iconOff={<EyeOff size={17} />}
              labelOn="Galeria otwarta"
              labelOff="Galeria zamknięta"
              onClick={() =>
                updateSettings({ galleryEnabled: !eventState.galleryEnabled })
              }
            />
            <button
              className="icon-button"
              onClick={logout}
              title={`Wyloguj (${sessionEmail})`}
              aria-label="Wyloguj"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-2">
          <TabButton
            active={tab === "photos"}
            onClick={() => switchTab("photos")}
          >
            <ImageIcon size={17} />
            Zdjęcia
          </TabButton>
          <TabButton
            active={tab === "gallery"}
            onClick={() => switchTab("gallery")}
          >
            <Eye size={17} />
            Galeria
          </TabButton>
          <TabButton active={tab === "qr"} onClick={() => switchTab("qr")}>
            <QrCode size={17} />
            QR
          </TabButton>
          <TabButton
            active={tab === "settings"}
            onClick={() => switchTab("settings")}
          >
            <Settings size={17} />
            Ustawienia
          </TabButton>
        </nav>

        {notice ? (
          <div className="notice mb-4" role="alert">
            {notice}
          </div>
        ) : null}

        {tab === "photos" ? (
          <section>
            <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                Zdjęcia
                <select
                  className="h-11 rounded-md border border-[var(--line)] bg-white px-3"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as FilterStatus);
                    setSelectedIds([]);
                    setVisibleCount(48);
                  }}
                >
                  {(
                    [
                      "ALL",
                      "NEW",
                      "SELECTED",
                      "PUBLISHED",
                      "HIDDEN",
                      "REJECTED",
                    ] as const
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "Wszystkie" : statusLabels[status]}{" "}
                      {counts[status]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="icon-button"
                  onClick={refreshPhotos}
                  disabled={refreshing}
                  title="Odśwież zdjęcia"
                  aria-label="Odśwież zdjęcia"
                >
                  <RefreshCw
                    size={18}
                    className={refreshing ? "animate-spin" : ""}
                  />
                </button>
                <DownloadArchive
                  endpoint="/api/admin/download"
                  status={filter}
                  disabled={!filteredPhotos.length}
                >
                  Pobierz {filter === "ALL" ? "wszystkie" : "z filtra"} (ZIP)
                </DownloadArchive>
              </div>
            </div>

            <div className="selection-bar">
              <label className="admin-photo-check">
                <input
                  type="checkbox"
                  checked={
                    visiblePhotos.length > 0 &&
                    visiblePhotos.every((photo) =>
                      selectedIds.includes(photo.id),
                    )
                  }
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked
                        ? visiblePhotos.map((photo) => photo.id)
                        : [],
                    )
                  }
                />
                Zaznacz widoczne
              </label>
              {selectedIds.length > 0 && (
                <>
                  <span aria-live="polite">
                    Zaznaczono: {selectedIds.length}
                  </span>
                  <DownloadArchive
                    endpoint="/api/admin/download"
                    ids={selectedIds}
                  >
                    Pobierz wybrane ({selectedIds.length})
                  </DownloadArchive>
                </>
              )}
            </div>

            <PhotoGrid
              photos={visiblePhotos}
              busyPhotoId={busyPhotoId}
              onAction={updatePhoto}
              onCrop={setCropPhoto}
              onPreview={(index) =>
                setPreview({ photos: visiblePhotos, index })
              }
              selectedIds={selectedIds}
              onSelect={toggleSelection}
            />
            {visibleCount < filteredPhotos.length && (
              <div className="mt-6 text-center">
                <button
                  className="btn-secondary"
                  onClick={() => setVisibleCount((count) => count + 48)}
                >
                  Pokaż kolejne ({visiblePhotos.length} z{" "}
                  {filteredPhotos.length})
                </button>
              </div>
            )}
          </section>
        ) : null}

        {tab === "gallery" ? (
          <section>
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase text-[#62775e]">
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
              photos={publishedPhotos.slice(0, visibleCount)}
              busyPhotoId={busyPhotoId}
              onAction={updatePhoto}
              onCrop={setCropPhoto}
              onPreview={(index) =>
                setPreview({
                  photos: publishedPhotos.slice(0, visibleCount),
                  index,
                })
              }
            />
            {visibleCount < publishedPhotos.length && (
              <div className="mt-6 text-center">
                <button
                  className="btn-secondary"
                  onClick={() => setVisibleCount((count) => count + 48)}
                >
                  Pokaż kolejne ({visibleCount} z {publishedPhotos.length})
                </button>
              </div>
            )}
          </section>
        ) : null}

        {tab === "qr" ? (
          <section>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase text-[#62775e]">
                Do druku
              </p>
              <h2 className="font-serif text-4xl">Kody QR</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Każdy kod daje ten sam dostęp do albumu. Wrzucanie i oglądanie
                zdjęć otwierasz osobno w ustawieniach. Kod można też wpisać na stronie głównej.
              </p>
              <button className="btn-secondary mt-4" onClick={rotateAccess} disabled={settingsBusy}>
                <RefreshCw size={17} />
                {settingsBusy ? "Zapisywanie..." : "Wygeneruj nowe kody dostępu"}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <QrCard
                title="Dostęp dla gości"
                subtitle="Postaw na stolikach i przy parkiecie"
                url={uploadUrl}
                code={eventState.uploadToken}
              />
              <QrCard
                title="Dodatkowy kod dostępu"
                subtitle="Ten kod może trafić do wiadomości dla gości"
                url={galleryUrl}
                code={eventState.galleryToken}
              />
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
                  onClick={() =>
                    updateSettings({ uploadEnabled: !eventState.uploadEnabled })
                  }
                />
                <SettingRow
                  title="Oglądanie galerii przez gości"
                  description="Goście zobaczą tylko zdjęcia oznaczone jako opublikowane."
                  enabled={eventState.galleryEnabled}
                  onClick={() =>
                    updateSettings({
                      galleryEnabled: !eventState.galleryEnabled,
                    })
                  }
                />
              </div>
            </div>

            <div className="paper-surface rounded-[8px] border border-[var(--line)] p-5">
              <h2 className="font-serif text-3xl">Prywatne linki dostępu</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="font-semibold uppercase text-[#62775e]">
                    Dostęp dla gości
                  </dt>
                  <dd className="mt-1 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3">
                    {uploadUrl}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase text-[#62775e]">
                    Dodatkowy dostęp dla gości
                  </dt>
                  <dd className="mt-1 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3">
                    {galleryUrl}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}
      </div>

      {preview && (
        <PhotoViewer
          initialIndex={preview.index}
          onClose={() => setPreview(null)}
          photos={preview.photos.map((photo) => ({
            id: photo.id,
            src: `/api/admin/photos/${photo.id}/file?variant=${photo.status === "PUBLISHED" ? "published" : "web"}&v=${encodeURIComponent(photo.updatedAt)}`,
            downloadUrl: `/api/admin/photos/${photo.id}/file?variant=original&download=1`,
            label: photo.originalName ?? "Zdjęcie weselne",
          }))}
        />
      )}

      {cropPhoto ? (
        <CropModal
          photo={cropPhoto}
          onClose={() => setCropPhoto(null)}
          onSaved={(updated) => {
            setPhotos((current) =>
              current.map((photo) =>
                photo.id === updated.id ? updated : photo,
              ),
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
      className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-[#465e49] bg-[#465e49] text-white"
          : "border-[var(--line)] bg-white/72 text-[#292e2c]"
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
  disabled,
}: {
  enabled: boolean;
  labelOn: string;
  labelOff: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-semibold ${
        enabled ? "bg-[#62775e] text-white" : "bg-[#a13e46] text-white"
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={enabled}
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
  onPreview,
  selectedIds = [],
  onSelect,
}: {
  photos: PhotoDto[];
  busyPhotoId: string | null;
  onAction: (id: string, action: string) => void;
  onCrop: (photo: PhotoDto) => void;
  onPreview: (index: number) => void;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
}) {
  if (!photos.length) {
    return (
      <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/58 px-5 py-12 text-center">
        <ImageIcon className="mx-auto mb-3 text-[#62775e]" size={32} />
        <p className="font-bold">Nie ma tu jeszcze zdjęć.</p>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      {photos.map((photo, index) => (
        <article
          key={photo.id}
          className="overflow-hidden rounded-[6px] border border-[var(--line)] bg-white"
        >
          <button
            className="block aspect-[4/3] w-full bg-[var(--paper-deep)]"
            onClick={() => onPreview(index)}
            title="Otwórz podgląd"
            aria-label={`Otwórz zdjęcie ${index + 1}`}
          >
            <img
              src={`/api/admin/photos/${photo.id}/file?variant=${photo.status === "PUBLISHED" ? "published" : "thumb"}&v=${encodeURIComponent(
                photo.updatedAt,
              )}`}
              alt={photo.originalName ?? "Zdjęcie weselne"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>

          <div className="p-3">
            {onSelect && (
              <label className="admin-photo-check">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(photo.id)}
                  onChange={() => onSelect(photo.id)}
                />
                Do pobrania
              </label>
            )}
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
              <p className="mb-2 line-clamp-2 text-xs font-semibold text-[#a13e46]">
                Miniatura zastępcza: {photo.error}
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 border-y border-[var(--line)] py-2 text-sm font-semibold">
                {photo.status === "PUBLISHED"
                  ? "W galerii gości"
                  : "Poza galerią"}
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Publikacja w galerii gości"
                  checked={photo.status === "PUBLISHED"}
                  disabled={busyPhotoId !== null}
                  onChange={() =>
                    onAction(
                      photo.id,
                      photo.status === "PUBLISHED" ? "unpublish" : "publish",
                    )
                  }
                />
              </label>

              <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                <button
                  className="btn-secondary min-h-10 px-3 py-2 text-sm"
                  onClick={() => onCrop(photo)}
                  disabled={busyPhotoId !== null}
                >
                  <Crop size={17} />
                  {photo.crop ? "Popraw kadr" : "Kadruj"}
                </button>
                <a
                  className="icon-button border border-[var(--line)]"
                  href={`/api/admin/photos/${photo.id}/file?variant=original&download=1`}
                  aria-label="Pobierz oryginał"
                  title="Pobierz oryginał"
                >
                  <Download size={17} />
                </a>
              </div>

              <details className="pt-1">
                <summary className="cursor-pointer py-2 text-xs text-[var(--muted)]">
                  Porządkowanie
                </summary>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-[#62775e]">
                    Status roboczy
                  </span>
                  <select
                    className="focus-ring h-10 w-full rounded-[8px] border border-[var(--line)] bg-white px-2 text-sm font-bold text-[#292e2c]"
                    value={photo.status}
                    disabled={busyPhotoId !== null}
                    onChange={(event) =>
                      onAction(
                        photo.id,
                        statusToAction(
                          event.target.value as PhotoDto["status"],
                        ),
                      )
                    }
                  >
                    <option value="NEW">Nowe</option>
                    <option value="SELECTED">Wybrane</option>
                    <option value="PUBLISHED">Opublikowane</option>
                    <option value="HIDDEN">Ukryte</option>
                    <option value="REJECTED">Odrzucone</option>
                  </select>
                </label>
              </details>
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

function QrCard({
  title,
  subtitle,
  url,
  code,
}: {
  title: string;
  subtitle: string;
  url: string;
  code: string;
}) {
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
          <p className="mt-4 text-xs font-semibold uppercase text-[var(--olive)]">Kod do wpisania na stronie</p>
          <p className="mt-1 break-all rounded-[8px] border border-[var(--line)] bg-white/70 p-3 font-mono text-sm">
            {code}
          </p>
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
        className={`inline-flex min-h-10 min-w-24 items-center justify-center rounded-[8px] px-3 text-sm font-semibold text-white ${
          enabled ? "bg-[#62775e]" : "bg-[#a13e46]"
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
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  async function save() {
    if (!area) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/photos/${photo.id}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crop: area, zoom, point: crop }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Nie udało się zapisać kadru.");
        return;
      }

      const body = (await response.json()) as { photo: PhotoDto };
      onSaved(body.photo);
    } catch {
      setError("Nie udało się zapisać kadru. Sprawdź połączenie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="crop-dialog"
      aria-label="Kadrowanie zdjęcia"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#62775e]">
              Kadrowanie
            </p>
            <h2 className="font-serif text-3xl">
              {photo.crop ? "Popraw kadr" : "Wersja do galerii"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Zamknij kadrowanie"
            title="Zamknij kadrowanie"
          >
            <X size={17} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#222824]">
          <Cropper
            image={`/api/admin/photos/${photo.id}/file?variant=web&v=${encodeURIComponent(
              photo.updatedAt,
            )}`}
            crop={crop}
            zoom={zoom}
            aspect={photo.crop?.aspect ?? 4 / 3}
            initialCroppedAreaPixels={photo.crop?.area}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) =>
              setArea(croppedAreaPixels)
            }
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-1 items-center gap-3">
            <span className="text-sm font-semibold">Powiększenie</span>
            <input
              className="w-full accent-[#62775e]"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={saving}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {error ? (
              <p className="self-center text-sm font-bold text-[#a13e46]">
                {error}
              </p>
            ) : null}
            <button
              className="btn-primary"
              onClick={save}
              disabled={saving || !area}
            >
              {photo.crop ? <Pencil size={17} /> : <Check size={17} />}
              {saving ? "Zapisywanie..." : "Zapisz kadr"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

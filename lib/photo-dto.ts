import type { Event, Photo } from "@/generated/prisma/client";

export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropSettings = {
  area: CropArea;
  zoom: number;
  point: {
    x: number;
    y: number;
  };
  aspect: number;
};

export type PhotoDto = {
  id: string;
  status: Photo["status"];
  originalName: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  guestName: string | null;
  crop: CropSettings | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventDto = {
  id: string;
  coupleName: string;
  weddingDate: string | null;
  uploadToken: string;
  galleryToken: string;
  uploadEnabled: boolean;
  galleryEnabled: boolean;
};

export function toPhotoDto(photo: Photo): PhotoDto {
  return {
    id: photo.id,
    status: photo.status,
    originalName: photo.originalName,
    mimeType: photo.mimeType,
    size: photo.size,
    width: photo.width,
    height: photo.height,
    guestName: photo.guestName,
    crop: parseCropSettings(photo.crop),
    error: photo.error,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
  };
}

export function toEventDto(event: Event): EventDto {
  return {
    id: event.id,
    coupleName: event.coupleName,
    weddingDate: event.weddingDate?.toISOString() ?? null,
    uploadToken: event.uploadToken,
    galleryToken: event.galleryToken,
    uploadEnabled: event.uploadEnabled,
    galleryEnabled: event.galleryEnabled,
  };
}

function parseCropSettings(value: unknown): CropSettings | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  const areaSource =
    object.area && typeof object.area === "object"
      ? (object.area as Record<string, unknown>)
      : object;

  const area = {
    x: Number(areaSource.x),
    y: Number(areaSource.y),
    width: Number(areaSource.width),
    height: Number(areaSource.height),
  };

  if (
    !Number.isFinite(area.x) ||
    !Number.isFinite(area.y) ||
    !Number.isFinite(area.width) ||
    !Number.isFinite(area.height) ||
    area.width <= 0 ||
    area.height <= 0
  ) {
    return null;
  }

  const pointSource =
    object.point && typeof object.point === "object"
      ? (object.point as Record<string, unknown>)
      : null;

  return {
    area,
    zoom: Number.isFinite(Number(object.zoom)) ? Number(object.zoom) : 1,
    point: {
      x: pointSource && Number.isFinite(Number(pointSource.x)) ? Number(pointSource.x) : 0,
      y: pointSource && Number.isFinite(Number(pointSource.y)) ? Number(pointSource.y) : 0,
    },
    aspect: Number.isFinite(Number(object.aspect)) ? Number(object.aspect) : 4 / 3,
  };
}

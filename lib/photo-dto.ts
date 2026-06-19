import type { Event, Photo } from "@/generated/prisma/client";

export type PhotoDto = {
  id: string;
  status: Photo["status"];
  originalName: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  guestName: string | null;
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

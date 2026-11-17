"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UPLOAD_QUALITY_OPTIONS,
  type UploadQuality,
  qualityForUpload,
  shouldCompressUpload,
} from "@/lib/upload-quality";

const MAX_MB = 25;
/** Per-chunk byte size for the proxied upload (~3 MB keeps far under Vercel's body limit). */
const CHUNK_SIZE = 3 * 1024 * 1024;

type Props = {
  eventId: string;
  /** True when the studio has a working Google Drive connection. */
  driveConnected: boolean;
  /** True when uploads must go to Drive (production). Dev keeps the proxy path. */
  driveRequired: boolean;
};

export function UploadDropzone({ eventId, driveConnected, driveRequired }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activity, setActivity] = useState<string | null>(null);
  const [uploadQuality, setUploadQuality] = useState<UploadQuality>("original");
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function prepareForUpload(file: File): Promise<{ file: File; warning?: string }> {
    const quality = qualityForUpload(uploadQuality);
    if (quality === null || !shouldCompressUpload(uploadQuality, file.name)) return { file };

    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      image.close();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("Browser could not create a JPEG");
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      return {
        file: new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified }),
      };
    } catch {
      return {
        file,
        warning: `${file.name}: couldn’t be compressed in this browser, so the original was uploaded`,
      };
    }
  }

  /**
   * Upload one file to Google Drive. The browser starts a resumable session via
   * `/drive-session`, then streams the bytes up in small chunks through our
   * server (`/upload-chunk`) which forwards them to Drive server-side. We proxy
   * because Drive's upload endpoint does not send `Access-Control-Allow-Origin`,
   * so a browser cannot PUT to it directly. Each chunk + headers stays below
   * Vercel's ~4.5 MB request limit.
   */
  async function uploadToDrive(file: File): Promise<string | null> {
    const sessionResponse = await fetch(`/api/events/${eventId}/photos/drive-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    });
    const session = (await sessionResponse.json()) as {
      uploadUrl?: string;
      error?: string;
      code?: string;
    };
    if (!sessionResponse.ok || !session.uploadUrl) {
      return session.error ?? "Could not start the Drive upload";
    }
    const { uploadUrl } = session;

    let offset = 0;
    let fileId: string | null | undefined;
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const blob = file.slice(offset, end);
      const body = await blob.arrayBuffer();

      const chunkResponse = await fetch(`/api/events/${eventId}/photos/upload-chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-drive-upload-url": uploadUrl,
          "x-drive-offset": String(offset),
          "x-drive-total": String(file.size),
        },
        body,
      });
      const res = (await chunkResponse.json()) as {
        nextOffset?: number;
        finished?: boolean;
        fileId?: string | null;
        error?: string;
      };
      if (!chunkResponse.ok || res.error) {
        return res.error ?? `${file.name}: chunk upload failed`;
      }
      offset = res.nextOffset ?? end;
      fileId = res.fileId ?? fileId;
      if (res.finished) break;
    }

    if (!fileId) return `${file.name}: Drive did not return a file id`;

    const register = await fetch(`/api/events/${eventId}/photos/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driveFileId: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
      }),
    });
    const registered = (await register.json()) as { error?: string };
    if (!register.ok) return registered.error ?? `${file.name}: could not be processed`;
    return null;
  }

  /** Dev fallback: the server stores the photo (small files only). */
  async function uploadThroughProxy(files: File[]): Promise<string[]> {
    const collected: string[] = [];
    for (let index = 0; index < files.length; index += 20) {
      const batch = files.slice(index, index + 20);
      const body = new FormData();
      for (const file of batch) body.append("files", file);
      try {
        const response = await fetch(`/api/events/${eventId}/photos`, { method: "POST", body });
        const data = (await response.json()) as {
          failed?: { reason: string }[];
          error?: string;
        };
        if (!response.ok) collected.push(data.error ?? "Upload failed");
        else for (const failure of data.failed ?? []) collected.push(failure.reason);
      } catch {
        collected.push("Network error while uploading a batch");
      }
      setProgress((current) => ({ ...current, done: Math.min(index + 20, files.length) }));
    }
    return collected;
  }

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setProgress({ done: 0, total: files.length });

    const collected: string[] = [];
    if (driveConnected) {
      for (let index = 0; index < files.length; index += 1) {
        const source = files[index];
        try {
          setActivity(`Preparing ${index + 1} of ${files.length}…`);
          const prepared = await prepareForUpload(source);
          if (prepared.warning) collected.push(prepared.warning);
          setActivity(`Uploading ${index + 1} of ${files.length} to Google Drive…`);
          const file = prepared.file;
          const error = await uploadToDrive(file);
          if (error) collected.push(error);
        } catch {
          collected.push(`${source.name}: network error — please retry`);
        }
        setProgress({ done: index + 1, total: files.length });
      }
    } else {
      const preparedFiles: File[] = [];
      for (let index = 0; index < files.length; index += 1) {
        setActivity(`Preparing ${index + 1} of ${files.length}…`);
        const prepared = await prepareForUpload(files[index]);
        preparedFiles.push(prepared.file);
        if (prepared.warning) collected.push(prepared.warning);
      }
      setActivity("Uploading photos…");
      collected.push(...(await uploadThroughProxy(preparedFiles)));
    }

    setErrors(collected);
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    setActivity(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    const oversize = files.filter((file) => file.size > MAX_MB * 1024 * 1024);
    if (oversize.length > 0) {
      setErrors(oversize.map((file) => `${file.name}: larger than ${MAX_MB} MB`));
    }
    await upload(files.filter((file) => file.size <= MAX_MB * 1024 * 1024));
  }

  const needsDrive = driveRequired && !driveConnected;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && !needsDrive) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy && !needsDrive) void onFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging ? "border-brand bg-brand-soft/30" : "border-line bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.orf,.rw2,.raf,.pef,.srw,.raw"
          className="sr-only"
          id="photo-upload"
          onChange={(event) => void onFiles(event.target.files)}
        />

        {needsDrive ? (
          <>
            <p className="text-sm font-medium">Connect Google Drive to upload photos</p>
            <p className="mt-1.5 text-xs text-muted">
              Originals, thumbnails and previews are stored in your own Drive. Nothing is
              copied to PicDeck storage.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
            >
              Go to Settings
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto max-w-md text-left">
              <label htmlFor="upload-quality" className="text-sm font-medium">
                Save uploaded photos as
              </label>
              <select
                id="upload-quality"
                value={uploadQuality}
                disabled={busy}
                onChange={(event) => setUploadQuality(event.target.value as UploadQuality)}
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none disabled:opacity-50"
              >
                {UPLOAD_QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.description}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted">
                Compression creates a JPEG before upload. RAW and unsupported files stay original;
                file-size savings vary by image.
              </p>
            </div>
            <p className="mt-5 text-sm font-medium">
              {busy ? activity ?? "Uploading…" : "Drop photos here, or choose files"}
            </p>
            <p className="mt-1.5 text-xs text-muted">
              JPEG, PNG, WebP, HEIC, TIFF and common RAW files. Up to {MAX_MB} MB each.{" "}
              {driveConnected ? "Saved to your Google Drive." : ""}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Choose photos"}
            </button>
          </>
        )}

        {busy && progress.total > 0 && (
          <div className="mx-auto mt-4 max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {Math.min(progress.done, progress.total)} of {progress.total} uploaded
            </p>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {errors.slice(0, 6).map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
          {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

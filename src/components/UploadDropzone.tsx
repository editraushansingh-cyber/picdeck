"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BATCH_SIZE = 20;
const MAX_MB = 25;

export function UploadDropzone({ eventId }: { eventId: string }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setProgress({ done: 0, total: files.length });

    const collected: string[] = [];
    for (let index = 0; index < files.length; index += BATCH_SIZE) {
      const batch = files.slice(index, index + BATCH_SIZE);
      const body = new FormData();
      for (const file of batch) body.append("files", file);
      try {
        const response = await fetch(`/api/events/${eventId}/photos`, {
          method: "POST",
          body,
        });
        const data = (await response.json()) as {
          stored?: number;
          failed?: { name: string; reason: string }[];
          error?: string;
        };
        if (!response.ok) {
          collected.push(data.error ?? "Upload failed");
        } else {
          for (const failure of data.failed ?? []) collected.push(failure.reason);
        }
        setProgress({ done: Math.min(index + BATCH_SIZE, files.length), total: files.length });
      } catch {
        collected.push("Network error while uploading a batch");
      }
    }

    setErrors(collected);
    setBusy(false);
    setProgress({ done: 0, total: 0 });
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

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void onFiles(event.dataTransfer.files);
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
        <p className="text-sm font-medium">
          {busy ? "Uploading…" : "Drop photos here, or choose files"}
        </p>
        <p className="mt-1.5 text-xs text-muted">
          JPEG, PNG, WebP, HEIC, TIFF and common RAW files. Up to {MAX_MB} MB each,{" "}
          {BATCH_SIZE} at a time.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? "Please wait…" : "Choose photos"}
        </button>
        {busy && progress.total > 0 && (
          <div className="mx-auto mt-4 max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {Math.min(progress.done, progress.total)} of {progress.total} processed
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

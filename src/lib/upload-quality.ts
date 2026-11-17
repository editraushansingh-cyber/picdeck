const RAW_EXTENSION = /\.(cr2|cr3|nef|arw|dng|orf|rw2|raf|pef|srw|raw)$/i;

export const UPLOAD_QUALITY_OPTIONS = [
  { value: "original", label: "Original (100%)", description: "Keep the exact camera file" },
  { value: "high", label: "High (50%)", description: "Smaller JPEGs with strong detail" },
  { value: "medium", label: "Medium (30%)", description: "Balanced upload size and detail" },
  { value: "small", label: "Small (20%)", description: "Smallest JPEG files" },
] as const;

export type UploadQuality = (typeof UPLOAD_QUALITY_OPTIONS)[number]["value"];

export function qualityForUpload(quality: UploadQuality): number | null {
  if (quality === "high") return 0.5;
  if (quality === "medium") return 0.3;
  if (quality === "small") return 0.2;
  return null;
}

export function shouldCompressUpload(quality: UploadQuality, filename: string): boolean {
  return qualityForUpload(quality) !== null && !RAW_EXTENSION.test(filename);
}

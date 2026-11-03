import path from "node:path";
import fs from "node:fs";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function saveUploadedVideo(buffer: Buffer, originalName: string): {
  filename: string;
  sizeBytes: number;
  localUrl: string;
} {
  const safeExt = path.extname(originalName) || ".mp4";
  const baseName = path
    .basename(originalName, safeExt)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${uniquePrefix}_${baseName}${safeExt}`;
  const fullPath = path.join(UPLOADS_DIR, filename);

  fs.writeFileSync(fullPath, buffer);

  return {
    filename,
    sizeBytes: buffer.length,
    localUrl: `/api/videos/${filename}`,
  };
}

export function deleteStoredVideo(filename: string): boolean {
  if (!filename || filename.startsWith("demo_")) {
    return true; // Demo virtual files are marked deleted without disk error
  }
  const safeName = path.basename(filename);
  const fullPath = path.join(UPLOADS_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    return true;
  }
  return false;
}

export function StoredVideoExists(filename: string): boolean {
  if (!filename || filename.startsWith("demo_")) return false;
  const safeName = path.basename(filename);
  return fs.existsSync(path.join(UPLOADS_DIR, safeName));
}


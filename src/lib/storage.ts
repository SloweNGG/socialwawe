import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  uploadFileToAppwriteStorage,
  deleteFileFromAppwriteStorage,
} from "./appwrite";

function resolveUploadsDir(): string {
  const localDir = path.join(process.cwd(), "data", "uploads");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), "socialwawe_uploads");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

export const UPLOADS_DIR = resolveUploadsDir();

export async function saveUploadedVideo(
  buffer: Buffer,
  originalName: string,
  mimeType = "video/mp4"
): Promise<{
  filename: string;
  sizeBytes: number;
  localUrl: string;
}> {
  const safeExt = path.extname(originalName) || ".mp4";
  const baseName = path
    .basename(originalName, safeExt)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 16);
  const uniquePrefix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const filename = `${uniquePrefix}_${baseName}${safeExt}`;
  const fullPath = path.join(UPLOADS_DIR, filename);

  try {
    fs.writeFileSync(fullPath, buffer);
  } catch {
    // ignore if serverless read-only
  }

  // Upload to Appwrite Storage Bucket (socialwawe_media) for 24/7 cloud access
  const cloudFile = await uploadFileToAppwriteStorage(
    buffer,
    filename,
    mimeType
  );

  return {
    filename,
    sizeBytes: buffer.length,
    localUrl: cloudFile?.publicViewUrl || `/api/videos/${filename}`,
  };
}

export function deleteStoredVideo(filename: string): boolean {
  if (!filename || filename.startsWith("demo_")) {
    return true;
  }
  const safeName = path.basename(filename);

  // Also delete from Appwrite Cloud Storage asynchronously
  deleteFileFromAppwriteStorage(safeName).catch(() => {});

  const fullPath = path.join(UPLOADS_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // ignore
    }
    return true;
  }
  return true;
}

export function StoredVideoExists(filename: string): boolean {
  if (!filename || filename.startsWith("demo_")) return false;
  const safeName = path.basename(filename);
  return fs.existsSync(path.join(UPLOADS_DIR, safeName));
}

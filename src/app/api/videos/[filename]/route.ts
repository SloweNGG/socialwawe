import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { UPLOADS_DIR } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const safeName = path.basename(filename);
  const fullPath = path.join(UPLOADS_DIR, safeName);

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Video bulunamadı veya yayınlandıktan sonra silindi.", {
      status: 404,
    });
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const ext = path.extname(safeName).toLowerCase();
  const contentType =
    ext === ".mov"
      ? "video/quicktime"
      : ext === ".webm"
      ? "video/webm"
      : "video/mp4";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileBuffer.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}


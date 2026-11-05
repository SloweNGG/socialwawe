import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUploadedVideo } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Yüklenecek medya dosyası bulunamadı." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await saveUploadedVideo(
      buffer,
      file.name,
      file.type || "video/mp4"
    );

    return NextResponse.json({
      filename: saved.filename,
      originalName: file.name,
      sizeBytes: saved.sizeBytes,
      videoUrl: saved.localUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Yükleme hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

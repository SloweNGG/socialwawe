import { NextRequest, NextResponse } from "next/server";
import { processSinglePost, runDueScheduledPosts } from "@/lib/scheduler";

// GET handler so external cron jobs / Appwrite Scheduled Functions can trigger due posts 24/7
export async function GET() {
  try {
    const result = await runDueScheduledPosts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cron hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({ action: "runDue" }));

    if (body.action === "runDue" || !body.postId) {
      const result = await runDueScheduledPosts();
      return NextResponse.json(result);
    }

    if (body.postId) {
      const result = await processSinglePost(body.postId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Yayınlama hatası" },
          { status: 400 }
        );
      }
      return NextResponse.json({ post: result.post });
    }

    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

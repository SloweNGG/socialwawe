import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { processSinglePost, runDueScheduledPosts } from "@/lib/scheduler";

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser();
    const body = await req.json();

    if (body.action === "runDue") {
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


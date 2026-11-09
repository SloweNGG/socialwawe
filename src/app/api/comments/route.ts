import { NextRequest, NextResponse } from "next/server";
import { ensureCloudSyncedDb, InstagramAccount } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface IgMediaItem {
  id: string;
  caption?: string;
  media_type: "VIDEO" | "IMAGE" | "CAROUSEL_ALBUM";
  media_product_type?: "REELS" | "FEED" | "STORY";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  comments_count: number;
  like_count: number;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const db = await ensureCloudSyncedDb();

    const accountId = req.nextUrl.searchParams.get("accountId");
    const afterCursor = req.nextUrl.searchParams.get("after") || "";

    let account: InstagramAccount | undefined;
    if (accountId) {
      account = db
        .prepare("SELECT * FROM instagram_accounts WHERE id = ? AND user_id = ?")
        .get(accountId, user.id) as unknown as InstagramAccount | undefined;
    } else {
      account = db
        .prepare("SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(user.id) as unknown as InstagramAccount | undefined;
    }

    if (!account) {
      return NextResponse.json(
        { error: "Bağlı Instagram hesabı bulunamadı." },
        { status: 404 }
      );
    }

    const fields =
      "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count";
    let url = `${GRAPH_BASE}/${encodeURIComponent(
      account.ig_user_id
    )}/media?fields=${fields}&limit=40&access_token=${encodeURIComponent(
      account.access_token
    )}`;

    if (afterCursor) {
      url += `&after=${encodeURIComponent(afterCursor)}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Instagram gönderileri çekilirken hata oluştu.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      media: (data.data || []) as IgMediaItem[],
      nextCursor: data?.paging?.cursors?.after || null,
      hasNext: Boolean(data?.paging?.next),
    });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const db = await ensureCloudSyncedDb();
    const body = await req.json();

    const { accountId, mediaId, message } = body as {
      accountId?: string;
      mediaId?: string;
      message?: string;
    };

    if (!mediaId || !message || !message.trim()) {
      return NextResponse.json(
        { error: "Gönderi ID ve yorum metni zorunludur." },
        { status: 400 }
      );
    }

    let account: InstagramAccount | undefined;
    if (accountId) {
      account = db
        .prepare("SELECT * FROM instagram_accounts WHERE id = ? AND user_id = ?")
        .get(accountId, user.id) as unknown as InstagramAccount | undefined;
    } else {
      account = db
        .prepare("SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(user.id) as unknown as InstagramAccount | undefined;
    }

    if (!account) {
      return NextResponse.json(
        { error: "Bağlı Instagram hesabı bulunamadı." },
        { status: 404 }
      );
    }

    const url = `${GRAPH_BASE}/${encodeURIComponent(mediaId)}/comments`;
    const form = new URLSearchParams();
    form.set("message", message.trim());
    form.set("access_token", account.access_token);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          error:
            data?.error?.error_user_msg ||
            data?.error?.message ||
            "Yorum gönderilemedi.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      commentId: data.id,
      mediaId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

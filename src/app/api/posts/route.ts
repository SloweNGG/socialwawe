import { NextRequest, NextResponse } from "next/server";
import { getDb, syncRowToCloud, deleteRowFromCloud, ScheduledPost } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteStoredVideo } from "@/lib/storage";
import { runDueScheduledPosts } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);

    // Opportunistically process any due posts when polling or loading
    if (searchParams.get("checkDue") !== "0") {
      await runDueScheduledPosts();
    }

    const db = getDb();
    const posts = db
      .prepare(
        `SELECT p.*, a.username as account_username
         FROM scheduled_posts p
         LEFT JOIN instagram_accounts a ON a.id = p.account_id
         WHERE p.user_id = ?
         ORDER BY p.scheduled_at ASC`
      )
      .all(user.id) as unknown as ScheduledPost[];

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const db = getDb();
    try {
      db.exec("ALTER TABLE scheduled_posts ADD COLUMN thumb_offset_ms INTEGER NOT NULL DEFAULT 0;");
    } catch {
      // column already exists
    }
    try {
      db.exec("ALTER TABLE scheduled_posts ADD COLUMN carousel_files TEXT NOT NULL DEFAULT '[]';");
    } catch {
      // column already exists
    }
    const now = new Date().toISOString();

    // Supports single item or array of items (for Bulk Auto-Queue)
    const items = Array.isArray(body.items) ? body.items : [body];
    const createdIds: string[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO scheduled_posts (
        id, user_id, account_id, media_type, video_filename, video_original_name,
        video_url, video_size_bytes, carousel_files, caption, thumb_offset_ms, scheduled_at, delete_after_publish,
        file_deleted, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'scheduled', ?)
    `);

    for (const item of items) {
      if (!item.accountId || !item.scheduledAt) {
        continue;
      }

      const carouselArr = Array.isArray(item.carouselFiles)
        ? item.carouselFiles
        : [];

      const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      insertStmt.run(
        postId,
        user.id,
        item.accountId,
        item.mediaType || "REELS",
        item.videoFilename || carouselArr[0] || "external_media.mp4",
        item.videoOriginalName || item.videoFilename || "media",
        item.videoUrl || `/api/videos/${item.videoFilename || carouselArr[0] || "media"}`,
        Number(item.videoSizeBytes || 0),
        JSON.stringify(carouselArr),
        (item.caption || "").trim(),
        Math.max(0, Math.round(Number(item.thumbOffsetMs || 0))),
        new Date(item.scheduledAt).toISOString(),
        item.deleteAfterPublish === false || item.deleteAfterPublish === 0 ? 0 : 1,
        now
      );
      syncRowToCloud("scheduled_posts", "id", postId);
      createdIds.push(postId);
    }

    return NextResponse.json({ createdIds, count: createdIds.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kayıt hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { id, scheduledAt, caption, deleteAfterPublish } = body;

    if (!id) {
      return NextResponse.json({ error: "Gönderi ID gerekli" }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM scheduled_posts WHERE id = ? AND user_id = ?")
      .get(id, user.id) as unknown as ScheduledPost | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Gönderi bulunamadı" }, { status: 404 });
    }

    const nextScheduledAt = scheduledAt
      ? new Date(scheduledAt).toISOString()
      : existing.scheduled_at;
    const nextCaption =
      typeof caption === "string" ? caption : existing.caption;
    const nextDeleteAfter =
      typeof deleteAfterPublish === "boolean"
        ? deleteAfterPublish
          ? 1
          : 0
        : existing.delete_after_publish;

    db.prepare(
      `UPDATE scheduled_posts
       SET scheduled_at = ?, caption = ?, delete_after_publish = ?
       WHERE id = ? AND user_id = ?`
    ).run(nextScheduledAt, nextCaption, nextDeleteAfter, id, user.id);

    syncRowToCloud("scheduled_posts", "id", id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Güncelleme hatası" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Gönderi ID gerekli" }, { status: 400 });
    }

    const db = getDb();
    const post = db
      .prepare("SELECT * FROM scheduled_posts WHERE id = ? AND user_id = ?")
      .get(id, user.id) as unknown as ScheduledPost | undefined;

    if (post && post.file_deleted === 0) {
      deleteStoredVideo(post.video_filename);
      if (post.carousel_files) {
        try {
          const extraFiles: string[] = JSON.parse(post.carousel_files);
          for (const f of extraFiles) {
            deleteStoredVideo(f);
          }
        } catch {
          // ignore
        }
      }
    }

    db.prepare("DELETE FROM scheduled_posts WHERE id = ? AND user_id = ?").run(
      id,
      user.id
    );
    deleteRowFromCloud("scheduled_posts", id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Silme hatası" }, { status: 500 });
  }
}

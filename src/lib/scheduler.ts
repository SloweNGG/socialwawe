import {
  ensureCloudSyncedDb,
  syncRowToCloud,
  InstagramAccount,
  ScheduledPost,
  AppSettings,
} from "./db";
import { publishVideoToInstagram } from "./instagram";
import { deleteStoredVideo } from "./storage";

export async function processSinglePost(postId: string): Promise<{
  success: boolean;
  post?: ScheduledPost;
  error?: string;
}> {
  const db = await ensureCloudSyncedDb();

  const post = db
    .prepare("SELECT * FROM scheduled_posts WHERE id = ?")
    .get(postId) as unknown as ScheduledPost | undefined;

  if (!post) {
    return { success: false, error: "Gönderi bulunamadı." };
  }

  const account = db
    .prepare("SELECT * FROM instagram_accounts WHERE id = ?")
    .get(post.account_id) as unknown as InstagramAccount | undefined;

  if (!account) {
    db.prepare(
      "UPDATE scheduled_posts SET status = 'failed', error_message = ? WHERE id = ?"
    ).run("Bağlı Instagram hesabı bulunamadı.", postId);
    return { success: false, error: "Bağlı Instagram hesabı bulunamadı." };
  }

  const settings = db
    .prepare("SELECT * FROM app_settings WHERE user_id = ?")
    .get(post.user_id) as unknown as AppSettings | undefined;

  // Mark as processing
  db.prepare(
    "UPDATE scheduled_posts SET status = 'processing', error_message = NULL WHERE id = ?"
  ).run(postId);

  const result = await publishVideoToInstagram(
    account,
    post,
    settings?.public_base_url || ""
  );

  if (result.success) {
    let fileDeleted = post.file_deleted;
    if (post.delete_after_publish === 1) {
      const removed = deleteStoredVideo(post.video_filename);
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
      if (removed) {
        fileDeleted = 1;
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE scheduled_posts
      SET status = 'published',
          ig_container_id = ?,
          ig_media_id = ?,
          ig_permalink = ?,
          published_at = ?,
          file_deleted = ?,
          error_message = NULL
      WHERE id = ?
    `).run(
      result.containerId || null,
      result.mediaId || null,
      result.permalink || null,
      now,
      fileDeleted,
      postId
    );

    const updated = db
      .prepare("SELECT * FROM scheduled_posts WHERE id = ?")
      .get(postId) as unknown as ScheduledPost;

    syncRowToCloud("scheduled_posts", "id", postId);
    return { success: true, post: updated };
  } else {
    db.prepare(`
      UPDATE scheduled_posts
      SET status = 'failed',
          ig_container_id = ?,
          error_message = ?
      WHERE id = ?
    `).run(
      result.containerId || null,
      result.error || "Yayınlama başarısız oldu.",
      postId
    );

    syncRowToCloud("scheduled_posts", "id", postId);
    return { success: false, error: result.error };
  }
}

export async function runDueScheduledPosts(): Promise<{
  processedCount: number;
  publishedIds: string[];
  failedIds: string[];
}> {
  const db = await ensureCloudSyncedDb();
  const nowIso = new Date().toISOString();

  const duePosts = db
    .prepare(
      `SELECT id FROM scheduled_posts
       WHERE status = 'scheduled' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 10`
    )
    .all(nowIso) as unknown as { id: string }[];

  const publishedIds: string[] = [];
  const failedIds: string[] = [];

  for (const row of duePosts) {
    const res = await processSinglePost(row.id);
    if (res.success) {
      publishedIds.push(row.id);
    } else {
      failedIds.push(row.id);
    }
  }

  return {
    processedCount: duePosts.length,
    publishedIds,
    failedIds,
  };
}

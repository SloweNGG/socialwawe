import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "socialwawe.db");

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  plan: string;
  created_at: string;
}

export interface InstagramAccount {
  id: string;
  user_id: string;
  ig_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  access_token: string;
  token_expires_at: string;
  is_mock: number;
  followers_count: number;
  status: "active" | "expired" | "error";
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  account_id: string;
  account_username?: string;
  media_type: "REELS" | "VIDEO" | "STORIES";
  video_filename: string;
  video_original_name: string;
  video_url: string;
  video_size_bytes: number;
  caption: string;
  scheduled_at: string;
  delete_after_publish: number;
  file_deleted: number;
  status: "scheduled" | "processing" | "published" | "failed";
  ig_container_id: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

export interface AppSettings {
  user_id: string;
  meta_app_id: string;
  meta_app_secret: string;
  public_base_url: string;
  default_delete_after_publish: number;
  default_queue_times: string;
}

const globalForDb = globalThis as unknown as {
  __socialwawe_db?: DatabaseSync;
};

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "_socialwawe_salt").digest("hex");
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__socialwawe_db) {
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    initSchema(db);
    globalForDb.__socialwawe_db = db;
  }
  return globalForDb.__socialwawe_db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'pro',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ig_user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      access_token TEXT NOT NULL,
      token_expires_at TEXT NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0,
      followers_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'REELS',
      video_filename TEXT NOT NULL,
      video_original_name TEXT NOT NULL,
      video_url TEXT NOT NULL,
      video_size_bytes INTEGER NOT NULL DEFAULT 0,
      caption TEXT NOT NULL DEFAULT '',
      scheduled_at TEXT NOT NULL,
      delete_after_publish INTEGER NOT NULL DEFAULT 1,
      file_deleted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      ig_container_id TEXT,
      ig_media_id TEXT,
      ig_permalink TEXT,
      error_message TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      user_id TEXT PRIMARY KEY,
      meta_app_id TEXT NOT NULL DEFAULT '',
      meta_app_secret TEXT NOT NULL DEFAULT '',
      public_base_url TEXT NOT NULL DEFAULT '',
      default_delete_after_publish INTEGER NOT NULL DEFAULT 1,
      default_queue_times TEXT NOT NULL DEFAULT '["19:00"]'
    );
  `);

  // Seed default user and demo account if database is empty
  const existingUser = db.prepare("SELECT id FROM users LIMIT 1").get() as unknown as { id: string } | undefined;
  if (!existingUser) {
    const userId = "usr_default_admin";
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, plan, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, "Deniz Gülcan", "deniz@socialwawe.com", hashPassword("123456"), "agency", now);

    db.prepare(`
      INSERT INTO app_settings (user_id, meta_app_id, meta_app_secret, public_base_url, default_delete_after_publish, default_queue_times)
      VALUES (?, '', '', '', 1, '["13:00", "19:30"]')
    `).run(userId);

    const accId = "ig_demo_1";
    const expires = new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, display_name, avatar_url,
        access_token, token_expires_at, is_mock, followers_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      accId,
      userId,
      "17841405822304914",
      "socialwawe.tr",
      "SocialWawe Medya (Simülasyon)",
      "https://api.dicebear.com/9.x/shapes/svg?seed=socialwawe",
      "IGQVJ_SIMULATION_TOKEN_DEMO",
      expires,
      1,
      14800,
      "active",
      now
    );

    // Seed 2 sample scheduled posts so the calendar and dashboard look rich out of the box
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 30, 0, 0);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(19, 30, 0, 0);

    db.prepare(`
      INSERT INTO scheduled_posts (
        id, user_id, account_id, media_type, video_filename, video_original_name,
        video_url, video_size_bytes, caption, scheduled_at, delete_after_publish,
        file_deleted, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "post_demo_1",
      userId,
      accId,
      "REELS",
      "demo_reel_1.mp4",
      "motivasyon_kesit_01.mp4",
      "/api/videos/demo_reel_1.mp4",
      14250000,
      "Başarı tesadüf değildir, her gün atılan küçük adımların toplamıdır. 🚀 #motivasyon #girişimcilik #reels #keşfet",
      tomorrow.toISOString(),
      1,
      0,
      "scheduled",
      now
    );

    db.prepare(`
      INSERT INTO scheduled_posts (
        id, user_id, account_id, media_type, video_filename, video_original_name,
        video_url, video_size_bytes, caption, scheduled_at, delete_after_publish,
        file_deleted, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "post_demo_2",
      userId,
      accId,
      "REELS",
      "demo_reel_2.mp4",
      "yapay_zeka_ipuclari_02.mp4",
      "/api/videos/demo_reel_2.mp4",
      18900000,
      "Bu 3 otomasyon aracıyla haftada 10 saat tasarruf edin! Kaydetmeyi unutmayın 📌 #yapayzeka #otomasyon #teknoloji",
      dayAfter.toISOString(),
      1,
      0,
      "scheduled",
      now
    );
  }
}

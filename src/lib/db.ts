import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import {
  pullAllFromAppwriteToSqlite,
  upsertAppwriteRow,
  deleteAppwriteRow,
} from "./appwrite";

function resolveDataDir(): string {
  const localDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), "socialwawe_data");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const DATA_DIR = resolveDataDir();
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
  media_type: "REELS" | "VIDEO" | "STORIES" | "IMAGE" | "CAROUSEL";
  video_filename: string;
  video_original_name: string;
  video_url: string;
  video_size_bytes: number;
  carousel_files?: string; // JSON string of filenames for CAROUSEL posts
  caption: string;
  thumb_offset_ms: number;
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

export interface HashtagGroup {
  id: string;
  user_id: string;
  name: string;
  hashtags: string;
  created_at: string;
}

export interface CaptionTemplate {
  id: string;
  user_id: string;
  folder: string;
  title: string;
  content: string;
  created_at: string;
}

const globalForDb = globalThis as unknown as {
  __socialwawe_db?: DatabaseSync;
  __socialwawe_last_pull?: number;
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

export async function ensureCloudSyncedDb(): Promise<DatabaseSync> {
  const db = getDb();
  const now = Date.now();
  // Pull from Appwrite Cloud if not pulled in the last 10 seconds
  if (!globalForDb.__socialwawe_last_pull || now - globalForDb.__socialwawe_last_pull > 10000) {
    globalForDb.__socialwawe_last_pull = now;
    await pullAllFromAppwriteToSqlite(db);
  }
  return db;
}

export function syncRowToCloud(
  table: string,
  pkColumn: string,
  pkValue: string
): void {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`)
      .get(pkValue) as unknown as Record<string, unknown> | undefined;
    if (row) {
      upsertAppwriteRow(table, pkValue, row).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function deleteRowFromCloud(table: string, pkValue: string): void {
  deleteAppwriteRow(table, pkValue).catch(() => {});
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
      carousel_files TEXT NOT NULL DEFAULT '[]',
      caption TEXT NOT NULL DEFAULT '',
      thumb_offset_ms INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS hashtag_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS caption_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'Genel',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
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
  }
}

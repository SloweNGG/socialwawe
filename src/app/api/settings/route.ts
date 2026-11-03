import { NextRequest, NextResponse } from "next/server";
import { getDb, AppSettings } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = getDb();
    let settings = db
      .prepare("SELECT * FROM app_settings WHERE user_id = ?")
      .get(user.id) as unknown as AppSettings | undefined;

    if (!settings) {
      db.prepare(
        `INSERT INTO app_settings (user_id, meta_app_id, meta_app_secret, public_base_url, default_delete_after_publish, default_queue_times)
         VALUES (?, '', '', '', 1, '["19:00"]')`
      ).run(user.id);
      settings = db
        .prepare("SELECT * FROM app_settings WHERE user_id = ?")
        .get(user.id) as unknown as AppSettings;
    }

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const db = getDb();

    const {
      meta_app_id = "",
      meta_app_secret = "",
      public_base_url = "",
      default_delete_after_publish = 1,
      default_queue_times = '["19:00"]',
    } = body;

    db.prepare(
      `INSERT INTO app_settings (user_id, meta_app_id, meta_app_secret, public_base_url, default_delete_after_publish, default_queue_times)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         meta_app_id = excluded.meta_app_id,
         meta_app_secret = excluded.meta_app_secret,
         public_base_url = excluded.public_base_url,
         default_delete_after_publish = excluded.default_delete_after_publish,
         default_queue_times = excluded.default_queue_times`
    ).run(
      user.id,
      meta_app_id.trim(),
      meta_app_secret.trim(),
      public_base_url.trim(),
      default_delete_after_publish ? 1 : 0,
      typeof default_queue_times === "string"
        ? default_queue_times
        : JSON.stringify(default_queue_times)
    );

    const updated = db
      .prepare("SELECT * FROM app_settings WHERE user_id = ?")
      .get(user.id);

    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

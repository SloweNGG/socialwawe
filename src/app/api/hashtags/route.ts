import { NextRequest, NextResponse } from "next/server";
import { getDb, HashtagGroup } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function ensureHashtagTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS hashtag_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = ensureHashtagTable();
    const groups = db
      .prepare(
        "SELECT * FROM hashtag_groups WHERE user_id = ? ORDER BY created_at ASC"
      )
      .all(user.id) as unknown as HashtagGroup[];

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { name, hashtags } = body;

    if (!name || !hashtags) {
      return NextResponse.json(
        { error: "Grup adı ve etiketler zorunludur." },
        { status: 400 }
      );
    }

    // Format hashtags so words without # automatically get #
    const formattedTags = hashtags
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
      .join(" ");

    const db = ensureHashtagTable();
    const id = `hg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO hashtag_groups (id, user_id, name, hashtags, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, user.id, name.trim(), formattedTags, now);

    const created = db
      .prepare("SELECT * FROM hashtag_groups WHERE id = ?")
      .get(id) as unknown as HashtagGroup;

    return NextResponse.json({ group: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kayıt hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { id, name, hashtags } = body;

    if (!id || !name || !hashtags) {
      return NextResponse.json(
        { error: "Grup ID, grup adı ve etiketler zorunludur." },
        { status: 400 }
      );
    }

    const formattedTags = hashtags
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
      .join(" ");

    const db = ensureHashtagTable();
    db.prepare(
      "UPDATE hashtag_groups SET name = ?, hashtags = ? WHERE id = ? AND user_id = ?"
    ).run(name.trim(), formattedTags, id, user.id);

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
      return NextResponse.json({ error: "Grup ID gerekli" }, { status: 400 });
    }

    const db = ensureHashtagTable();
    db.prepare("DELETE FROM hashtag_groups WHERE id = ? AND user_id = ?").run(
      id,
      user.id
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Silme hatası" }, { status: 500 });
  }
}

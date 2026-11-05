import { NextRequest, NextResponse } from "next/server";
import { getDb, syncRowToCloud, deleteRowFromCloud, CaptionTemplate } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function ensureTemplatesTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS caption_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'Genel',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = ensureTemplatesTable();
    const templates = db
      .prepare(
        "SELECT * FROM caption_templates WHERE user_id = ? ORDER BY folder ASC, created_at ASC"
      )
      .all(user.id) as unknown as CaptionTemplate[];

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { folder, title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Şablon başlığı ve açıklama metni zorunludur." },
        { status: 400 }
      );
    }

    const cleanFolder = (folder || "Genel").trim() || "Genel";
    const db = ensureTemplatesTable();
    const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO caption_templates (id, user_id, folder, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, cleanFolder, title.trim(), content.trim(), now);

    syncRowToCloud("caption_templates", "id", id);
    const created = db
      .prepare("SELECT * FROM caption_templates WHERE id = ?")
      .get(id) as unknown as CaptionTemplate;

    return NextResponse.json({ template: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kayıt hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { id, folder, title, content } = body;

    if (!id || !title || !content) {
      return NextResponse.json(
        { error: "Şablon ID, başlık ve içerik zorunludur." },
        { status: 400 }
      );
    }

    const cleanFolder = (folder || "Genel").trim() || "Genel";
    const db = ensureTemplatesTable();
    db.prepare(
      "UPDATE caption_templates SET folder = ?, title = ?, content = ? WHERE id = ? AND user_id = ?"
    ).run(cleanFolder, title.trim(), content.trim(), id, user.id);

    syncRowToCloud("caption_templates", "id", id);
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
    const folder = searchParams.get("folder");

    const db = ensureTemplatesTable();

    if (folder) {
      const toDel = db
        .prepare("SELECT id FROM caption_templates WHERE folder = ? AND user_id = ?")
        .all(folder, user.id) as unknown as { id: string }[];
      db.prepare(
        "DELETE FROM caption_templates WHERE folder = ? AND user_id = ?"
      ).run(folder, user.id);
      for (const r of toDel) {
        deleteRowFromCloud("caption_templates", r.id);
      }
      return NextResponse.json({ ok: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Şablon ID gerekli" }, { status: 400 });
    }

    db.prepare("DELETE FROM caption_templates WHERE id = ? AND user_id = ?").run(
      id,
      user.id
    );
    deleteRowFromCloud("caption_templates", id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Silme hatası" }, { status: 500 });
  }
}


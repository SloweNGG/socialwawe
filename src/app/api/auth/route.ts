import { NextRequest, NextResponse } from "next/server";
import { getDb, hashPassword, User } from "@/lib/db";
import { createSessionToken, getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, name, email, password } = body;
  const db = getDb();
  const cookieStore = await cookies();

  if (action === "logout") {
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.set("socialwawe_logged_out", "1", { path: "/" });
    return NextResponse.json({ ok: true });
  }

  if (action === "register") {
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "İsim, e-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email.toLowerCase().trim()) as unknown as { id: string } | undefined;

    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı." },
        { status: 400 }
      );
    }

    const userId = `usr_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, plan, created_at)
       VALUES (?, ?, ?, ?, 'pro', ?)`
    ).run(
      userId,
      name.trim(),
      email.toLowerCase().trim(),
      hashPassword(password),
      now
    );

    db.prepare(
      `INSERT INTO app_settings (user_id, meta_app_id, meta_app_secret, public_base_url, default_delete_after_publish, default_queue_times)
       VALUES (?, '', '', '', 1, '["19:00"]')`
    ).run(userId);

    const token = createSessionToken(userId);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    cookieStore.delete("socialwawe_logged_out");

    return NextResponse.json({
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), plan: "pro" },
    });
  }

  if (action === "login") {
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get((email || "").toLowerCase().trim()) as unknown as User | undefined;

    if (!user || user.password_hash !== hashPassword(password || "")) {
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 }
      );
    }

    const token = createSessionToken(user.id);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    cookieStore.delete("socialwawe_logged_out");

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}

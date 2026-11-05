import { NextRequest, NextResponse } from "next/server";
import { getDb, syncRowToCloud, deleteRowFromCloud, InstagramAccount } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = getDb();
    const accounts = db
      .prepare(
        "SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY is_mock ASC, created_at DESC"
      )
      .all(user.id) as unknown as InstagramAccount[];

    return NextResponse.json({ accounts });
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
      mode, // 'real' | 'mock'
      username,
      displayName,
      igUserId,
      accessToken,
    } = body;

    const now = new Date().toISOString();
    const expires = new Date(
      Date.now() + 60 * 24 * 60 * 60 * 1000
    ).toISOString();
    const id = `ig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (mode === "mock") {
      const cleanUser = (username || "yenihesap").replace(/^@/, "").trim();
      db.prepare(
        `INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, display_name, avatar_url,
          access_token, token_expires_at, is_mock, followers_count, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'active', ?)`
      ).run(
        id,
        user.id,
        `178414_${Date.now().toString().slice(-6)}`,
        cleanUser,
        displayName || `@${cleanUser} (Test Modu)`,
        `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(cleanUser)}`,
        "IGQVJ_SIMULATION_TOKEN",
        expires,
        Math.floor(1500 + Math.random() * 45000),
        now
      );

      const created = db
        .prepare("SELECT * FROM instagram_accounts WHERE id = ?")
        .get(id);
      syncRowToCloud("instagram_accounts", "id", id);
      return NextResponse.json({ account: created });
    }

    // Real Meta Graph API connection
    if (!accessToken) {
      return NextResponse.json(
        { error: "Instagram Access Token zorunludur." },
        { status: 400 }
      );
    }

    let resolvedIgId = (igUserId || "").trim();
    let resolvedUsername = (username || "").replace(/^@/, "").trim();
    let resolvedName = displayName || resolvedUsername;
    let resolvedFollowers = 0;
    let resolvedAvatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(
      resolvedUsername || "ig"
    )}`;

    const baseUrl = accessToken.startsWith("IG")
      ? "https://graph.instagram.com/v21.0"
      : "https://graph.facebook.com/v21.0";

    try {
      const targetNode = resolvedIgId || "me";
      const profileRes = await fetch(
        `${baseUrl}/${targetNode}?fields=id,username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(
          accessToken.trim()
        )}`
      );
      const profileData = await profileRes.json();

      if (profileRes.ok && profileData.id) {
        resolvedIgId = profileData.id;
        resolvedUsername =
          profileData.username || resolvedUsername || "instagram_user";
        resolvedName = profileData.name || resolvedUsername;
        resolvedFollowers = profileData.followers_count || 0;
        if (profileData.profile_picture_url) {
          resolvedAvatar = profileData.profile_picture_url;
        }
      } else if (!resolvedIgId || !resolvedUsername) {
        return NextResponse.json(
          {
            error:
              profileData?.error?.message ||
              "Instagram API üzerinden hesap doğrulanamadı. Token ve IG User ID bilgilerini kontrol edin.",
          },
          { status: 400 }
        );
      }
    } catch {
      if (!resolvedIgId || !resolvedUsername) {
        return NextResponse.json(
          {
            error:
              "Instagram Graph API'ye bağlanılamadı. Lütfen IG User ID ve Kullanıcı Adını girin.",
          },
          { status: 400 }
        );
      }
    }

    db.prepare(
      `INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, display_name, avatar_url,
        access_token, token_expires_at, is_mock, followers_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', ?)`
    ).run(
      id,
      user.id,
      resolvedIgId,
      resolvedUsername,
      resolvedName,
      resolvedAvatar,
      accessToken.trim(),
      expires,
      resolvedFollowers,
      now
    );

    const created = db
      .prepare("SELECT * FROM instagram_accounts WHERE id = ?")
      .get(id);
    syncRowToCloud("instagram_accounts", "id", id);
    return NextResponse.json({ account: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Hesap ID gerekli" }, { status: 400 });
    }

    const db = getDb();
    db.prepare(
      "DELETE FROM instagram_accounts WHERE id = ? AND user_id = ?"
    ).run(id, user.id);
    deleteRowFromCloud("instagram_accounts", id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
}


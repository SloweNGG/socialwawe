import { cookies } from "next/headers";
import { ensureCloudSyncedDb, User } from "./db";
import crypto from "node:crypto";

const SESSION_COOKIE = "socialwawe_session";
const SECRET = process.env.SESSION_SECRET || "socialwawe_super_secret_key_2026";

export function createSessionToken(userId: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
  if (sig !== expected) return null;
  return userId;
}

export async function getCurrentUser(): Promise<User> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const db = await ensureCloudSyncedDb();

  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as unknown as User | undefined;
      if (user) return user;
    }
  }

  // Fallback to default seeded owner account for seamless initial setup unless logged out explicitly
  const loggedOut = cookieStore.get("socialwawe_logged_out")?.value === "1";
  if (!loggedOut) {
    const fallback = db.prepare("SELECT * FROM users WHERE id = 'usr_default_admin'").get() as unknown as User | undefined;
    if (fallback) return fallback;
  }

  throw new Error("UNAUTHORIZED");
}

export { SESSION_COOKIE };

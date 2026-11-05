import { DatabaseSync } from "node:sqlite";

export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1";

export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "6aec778e0020f9b756fe";

export const APPWRITE_API_KEY =
  process.env.APPWRITE_API_KEY ||
  "standard_c62cc4d1750d43b786dbc5c3e65c29b38ad1a8e6c2a1a8e795d58ee42daab105db8401445713ba520b6e9f36a516547c63b26177b34b760e6c39ed37d67ec52e6bfca4795830dcb972e15e7d8435e020e466de39e3169e666fea336e147771c523dd61715b768518bf919aa531494a81e86b8d11d0ea4f5337bfe9ff474e049f";

export const APPWRITE_DB_ID = "socialwawe_db";
export const APPWRITE_BUCKET_ID = "socialwawe_media";

function getAppwriteHeaders(isJson = true): Record<string, string> {
  const h: Record<string, string> = {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-Key": APPWRITE_API_KEY,
  };
  if (isJson) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

export function toAppwriteRowId(rawId: string): string {
  return String(rawId)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^[^a-zA-Z0-9]+/, "id_")
    .slice(0, 36);
}

/**
 * Uploads a media buffer (MP4, MOV, JPG, PNG, WEBP) to Appwrite Storage Bucket
 * and returns the direct public view URL.
 */
export async function uploadFileToAppwriteStorage(
  buffer: Buffer,
  filename: string,
  mimeType = "video/mp4"
): Promise<{ fileId: string; publicViewUrl: string } | null> {
  try {
    const fileId = toAppwriteRowId(filename.replace(/\.[^/.]+$/, ""));
    const form = new FormData();
    form.append("fileId", fileId);
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      filename
    );

    const res = await fetch(
      `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files`,
      {
        method: "POST",
        headers: getAppwriteHeaders(false),
        body: form,
      }
    );

    if (!res.ok) {
      return null;
    }

    const publicViewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${encodeURIComponent(
      fileId
    )}/view?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}`;

    return { fileId, publicViewUrl };
  } catch {
    return null;
  }
}

/**
 * Deletes a file from Appwrite Storage Bucket when "delete_after_publish" is active.
 */
export async function deleteFileFromAppwriteStorage(
  filenameOrFileId: string
): Promise<boolean> {
  try {
    const fileId = toAppwriteRowId(filenameOrFileId.replace(/\.[^/.]+$/, ""));
    const res = await fetch(
      `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${encodeURIComponent(
        fileId
      )}`,
      {
        method: "DELETE",
        headers: getAppwriteHeaders(true),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upserts a single SQLite record into Appwrite TablesDB.
 */
export async function upsertAppwriteRow(
  tableId: string,
  primaryKeyVal: string,
  rowObj: Record<string, unknown>
): Promise<void> {
  try {
    const rowId = toAppwriteRowId(primaryKeyVal);
    const body = JSON.stringify({
      data: {
        record_id: String(primaryKeyVal),
        payload_json: JSON.stringify(rowObj),
      },
    });

    // Try PATCH first; if 404, POST
    const patchRes = await fetch(
      `${APPWRITE_ENDPOINT}/tablesdb/${APPWRITE_DB_ID}/tables/${tableId}/rows/${encodeURIComponent(
        rowId
      )}`,
      {
        method: "PATCH",
        headers: getAppwriteHeaders(true),
        body,
      }
    );

    if (patchRes.status === 404) {
      await fetch(
        `${APPWRITE_ENDPOINT}/tablesdb/${APPWRITE_DB_ID}/tables/${tableId}/rows`,
        {
          method: "POST",
          headers: getAppwriteHeaders(true),
          body: JSON.stringify({
            rowId,
            data: {
              record_id: String(primaryKeyVal),
              payload_json: JSON.stringify(rowObj),
            },
          }),
        }
      );
    }
  } catch {
    // non-fatal background sync
  }
}

/**
 * Deletes a row from Appwrite TablesDB.
 */
export async function deleteAppwriteRow(
  tableId: string,
  primaryKeyVal: string
): Promise<void> {
  try {
    const rowId = toAppwriteRowId(primaryKeyVal);
    await fetch(
      `${APPWRITE_ENDPOINT}/tablesdb/${APPWRITE_DB_ID}/tables/${tableId}/rows/${encodeURIComponent(
        rowId
      )}`,
      {
        method: "DELETE",
        headers: getAppwriteHeaders(true),
      }
    );
  } catch {
    // ignore
  }
}

/**
 * Pulls all rows from Appwrite TablesDB into local SQLite database so serverless
 * instances (Appwrite Sites / Vercel) and multiple users always stay in sync.
 */
export async function pullAllFromAppwriteToSqlite(
  db: DatabaseSync
): Promise<void> {
  const tables: { name: string; pk: string }[] = [
    { name: "users", pk: "id" },
    { name: "instagram_accounts", pk: "id" },
    { name: "scheduled_posts", pk: "id" },
    { name: "hashtag_groups", pk: "id" },
    { name: "caption_templates", pk: "id" },
    { name: "app_settings", pk: "user_id" },
  ];

  for (const t of tables) {
    try {
      const res = await fetch(
        `${APPWRITE_ENDPOINT}/tablesdb/${APPWRITE_DB_ID}/tables/${t.name}/rows?limit=100`,
        { headers: getAppwriteHeaders(true), cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const rows = data.rows || [];

      for (const r of rows) {
        if (!r.payload_json) continue;
        const parsed = JSON.parse(r.payload_json);
        const cols = Object.keys(parsed);
        if (cols.length === 0) continue;

        const placeholders = cols.map(() => "?").join(", ");
        const sql = `INSERT OR REPLACE INTO ${t.name} (${cols.join(
          ", "
        )}) VALUES (${placeholders})`;
        const vals = cols.map((k) =>
          parsed[k] === undefined ? null : parsed[k]
        );
        try {
          db.prepare(sql).run(...vals);
        } catch {
          // ignore column mismatch on older rows
        }
      }
    } catch {
      // ignore network error
    }
  }
}


import { InstagramAccount, ScheduledPost } from "./db";
import path from "node:path";
import fs from "node:fs";
import { UPLOADS_DIR } from "./storage";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_BUCKET_ID,
  APPWRITE_PROJECT_ID,
  toAppwriteRowId,
  uploadFileToAppwriteStorage,
} from "./appwrite";

export interface PublishResult {
  success: boolean;
  containerId?: string;
  mediaId?: string;
  permalink?: string;
  error?: string;
}

function getGraphBaseUrl(accessToken: string): string {
  if (accessToken.startsWith("IG")) {
    return "https://graph.instagram.com/v21.0";
  }
  return "https://graph.facebook.com/v21.0";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isImageFile(filename: string): boolean {
  const ext = path.extname(filename || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
}

/**
 * Resolves a publicly reachable HTTPS URL for a local image file so Instagram Graph API can download it.
 * If the user configured a publicBaseUrl, uses that; otherwise bridges via temporary direct HTTPS host.
 */
async function resolvePublicImageUrl(
  filename: string,
  publicBaseUrl: string
): Promise<string> {
  if (filename.startsWith("http")) {
    return filename;
  }

  // Build Appwrite Cloud Storage URL for this filename
  const fileId = toAppwriteRowId(filename.replace(/\.[^/.]+$/, ""));
  const appwriteViewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${encodeURIComponent(
    fileId
  )}/view?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}`;

  // Check if already in Appwrite Storage
  try {
    const headRes = await fetch(appwriteViewUrl, { method: "HEAD" });
    if (headRes.ok) {
      return appwriteViewUrl;
    }
  } catch {
    // fallback below
  }

  // Otherwise if on local disk, upload to Appwrite Storage now
  const localPath = path.join(UPLOADS_DIR, path.basename(filename));
  if (fs.existsSync(localPath)) {
    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
    const up = await uploadFileToAppwriteStorage(buffer, filename, mime);
    if (up?.publicViewUrl) {
      return up.publicViewUrl;
    }
  }

  if (publicBaseUrl && publicBaseUrl.startsWith("http")) {
    return `${publicBaseUrl.replace(/\/$/, "")}/api/videos/${encodeURIComponent(
      path.basename(filename)
    )}`;
  }

  return appwriteViewUrl;
}

async function waitForContainerFinished(
  baseUrl: string,
  containerId: string,
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt < 24; attempt++) {
    await sleep(3000);
    const statusRes = await fetch(
      `${baseUrl}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    const statusData = await statusRes.json();

    // Image containers sometimes don't return status_code or immediately return FINISHED
    if (
      statusData.status_code === "FINISHED" ||
      statusData.status_code === "PUBLISHED" ||
      (!statusData.status_code && statusData.id)
    ) {
      return { ok: true };
    }

    if (
      statusData.status_code === "ERROR" ||
      statusData.status_code === "EXPIRED"
    ) {
      return {
        ok: false,
        error: `Instagram medya işleme hatası: ${
          statusData.status || statusData.status_code
        }`,
      };
    }
  }
  return {
    ok: false,
    error: "Instagram medya işleme süresi zaman aşımına uğradı.",
  };
}

export async function publishVideoToInstagram(
  account: InstagramAccount,
  post: ScheduledPost,
  publicBaseUrl: string
): Promise<PublishResult> {
  // 1. Simulation mode
  if (account.is_mock === 1) {
    await sleep(1200);
    const mockContainerId = `1790_${Date.now()}`;
    const mockMediaId = `1805_${Date.now()}`;
    return {
      success: true,
      containerId: mockContainerId,
      mediaId: mockMediaId,
      permalink: `https://www.instagram.com/p/C_${mockMediaId.slice(-8)}/`,
    };
  }

  const baseUrl = getGraphBaseUrl(account.access_token);

  try {
    let containerId = "";

    // =========================================================================
    // CASE A: CAROUSEL POST (2 to 10 images split or uploaded)
    // =========================================================================
    if (post.media_type === "CAROUSEL") {
      let slideFiles: string[] = [];
      try {
        slideFiles = JSON.parse(post.carousel_files || "[]");
      } catch {
        slideFiles = [];
      }

      if (slideFiles.length < 2) {
        return {
          success: false,
          error:
            "Kaydırmalı (Carousel) gönderi için en az 2 görsel parçası gereklidir.",
        };
      }

      const childIds: string[] = [];
      for (const slideFilename of slideFiles.slice(0, 10)) {
        const publicImgUrl = await resolvePublicImageUrl(
          slideFilename,
          publicBaseUrl
        );

        const itemParams = new URLSearchParams({
          is_carousel_item: "true",
          image_url: publicImgUrl,
          access_token: account.access_token,
        });

        const itemRes = await fetch(
          `${baseUrl}/${account.ig_user_id}/media?${itemParams.toString()}`,
          { method: "POST" }
        );
        const itemData = await itemRes.json();

        if (!itemRes.ok || itemData.error || !itemData.id) {
          return {
            success: false,
            error:
              itemData?.error?.message ||
              `Carousel parçası (${slideFilename}) oluşturulamadı.`,
          };
        }
        childIds.push(itemData.id);
      }

      // Create Parent Carousel Container
      const parentParams = new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        access_token: account.access_token,
      });
      if (post.caption) {
        parentParams.set("caption", post.caption);
      }

      const parentRes = await fetch(
        `${baseUrl}/${account.ig_user_id}/media?${parentParams.toString()}`,
        { method: "POST" }
      );
      const parentData = await parentRes.json();

      if (!parentRes.ok || parentData.error || !parentData.id) {
        return {
          success: false,
          error:
            parentData?.error?.message ||
            "Carousel ana kapsayıcısı oluşturulamadı.",
        };
      }

      containerId = parentData.id;
    }
    // =========================================================================
    // CASE B: SINGLE IMAGE POST or IMAGE STORY
    // =========================================================================
    else if (
      post.media_type === "IMAGE" ||
      (post.media_type === "STORIES" && isImageFile(post.video_filename))
    ) {
      const publicImgUrl = await resolvePublicImageUrl(
        post.video_filename,
        publicBaseUrl
      );

      const imgParams = new URLSearchParams({
        image_url: publicImgUrl,
        access_token: account.access_token,
      });

      if (post.media_type === "STORIES") {
        imgParams.set("media_type", "STORIES");
      } else if (post.caption) {
        imgParams.set("caption", post.caption);
      }

      const imgRes = await fetch(
        `${baseUrl}/${account.ig_user_id}/media?${imgParams.toString()}`,
        { method: "POST" }
      );
      const imgData = await imgRes.json();

      if (!imgRes.ok || imgData.error || !imgData.id) {
        return {
          success: false,
          error:
            imgData?.error?.message ||
            "Instagram fotoğraf gönderisi oluşturulamadı.",
        };
      }

      containerId = imgData.id;
    }
    // =========================================================================
    // CASE C: VIDEO / REELS / VIDEO STORY (Direct Resumable Binary Upload)
    // =========================================================================
    else {
      const localFilePath = path.join(
        UPLOADS_DIR,
        path.basename(post.video_filename)
      );
      const hasLocalFile = fs.existsSync(localFilePath);

      if (hasLocalFile) {
        const fileBuffer = fs.readFileSync(localFilePath);

        const initParams = new URLSearchParams({
          upload_type: "resumable",
          media_type: post.media_type || "REELS",
          access_token: account.access_token,
        });

        if (post.caption && post.media_type !== "STORIES") {
          initParams.set("caption", post.caption);
        }

        if (
          post.thumb_offset_ms &&
          post.thumb_offset_ms > 0 &&
          post.media_type !== "STORIES"
        ) {
          initParams.set("thumb_offset", String(Math.round(post.thumb_offset_ms)));
        }

        const initRes = await fetch(
          `${baseUrl}/${account.ig_user_id}/media?${initParams.toString()}`,
          { method: "POST" }
        );
        const initData = await initRes.json();

        if (!initRes.ok || initData.error || !initData.id) {
          return {
            success: false,
            error:
              initData?.error?.message ||
              "Instagram Resumable Media Container oluşturulamadı.",
          };
        }

        containerId = initData.id;
        const uploadUri =
          initData.uri ||
          `https://rupload.facebook.com/ig-api-upload/v21.0/${containerId}`;

        const uploadRes = await fetch(uploadUri, {
          method: "POST",
          headers: {
            Authorization: `OAuth ${account.access_token}`,
            offset: "0",
            file_size: fileBuffer.length.toString(),
            "Content-Type": "application/octet-stream",
          },
          body: fileBuffer,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || uploadData.error) {
          return {
            success: false,
            containerId,
            error:
              uploadData?.error?.message ||
              `Video dosyası Instagram sunucusuna yüklenemedi (HTTP ${uploadRes.status}).`,
          };
        }
      } else {
        // Cloud mode: Video is hosted in Appwrite Storage (socialwawe_media)
        const fileId = toAppwriteRowId(
          post.video_filename.replace(/\.[^/.]+$/, "")
        );
        const cloudVideoUrl = post.video_url.startsWith("http")
          ? post.video_url
          : `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${encodeURIComponent(
              fileId
            )}/view?project=${encodeURIComponent(APPWRITE_PROJECT_ID)}`;

        const createParams = new URLSearchParams({
          media_type: post.media_type || "REELS",
          video_url: cloudVideoUrl,
          access_token: account.access_token,
        });

        if (post.caption && post.media_type !== "STORIES") {
          createParams.set("caption", post.caption);
        }
        if (
          post.thumb_offset_ms &&
          post.thumb_offset_ms > 0 &&
          post.media_type !== "STORIES"
        ) {
          createParams.set(
            "thumb_offset",
            String(Math.round(post.thumb_offset_ms))
          );
        }

        const containerRes = await fetch(
          `${baseUrl}/${account.ig_user_id}/media?${createParams.toString()}`,
          { method: "POST" }
        );
        const containerData = await containerRes.json();

        if (!containerRes.ok || containerData.error || !containerData.id) {
          return {
            success: false,
            error:
              containerData?.error?.message ||
              "Appwrite Cloud üzerindeki video Instagram'a iletilemedi.",
          };
        }
        containerId = containerData.id;
      }
    }

    // Step B: Wait until container is FINISHED
    const waitResult = await waitForContainerFinished(
      baseUrl,
      containerId,
      account.access_token
    );
    if (!waitResult.ok) {
      return {
        success: false,
        containerId,
        error: waitResult.error,
      };
    }

    // Step C: Publish Media Container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: account.access_token,
    });

    const publishRes = await fetch(
      `${baseUrl}/${account.ig_user_id}/media_publish?${publishParams.toString()}`,
      { method: "POST" }
    );
    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error || !publishData.id) {
      return {
        success: false,
        containerId,
        error:
          publishData?.error?.message ||
          "Instagram media_publish işlemi başarısız oldu.",
      };
    }

    const mediaId: string = publishData.id;

    // Step D: Fetch Permalink
    let permalink = `https://www.instagram.com/${account.username}/`;
    try {
      const linkRes = await fetch(
        `${baseUrl}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(
          account.access_token
        )}`
      );
      const linkData = await linkRes.json();
      if (linkData.permalink) {
        permalink = linkData.permalink;
      }
    } catch {
      // non-fatal
    }

    return {
      success: true,
      containerId,
      mediaId,
      permalink,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen ağ hatası";
    return {
      success: false,
      error: message,
    };
  }
}

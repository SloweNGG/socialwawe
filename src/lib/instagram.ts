import { InstagramAccount, ScheduledPost } from "./db";
import path from "node:path";
import fs from "node:fs";
import { UPLOADS_DIR } from "./storage";

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

export async function publishVideoToInstagram(
  account: InstagramAccount,
  post: ScheduledPost,
  publicBaseUrl: string
): Promise<PublishResult> {
  // 1. Check if account is in simulation/test mode
  if (account.is_mock === 1) {
    await sleep(1200);
    const mockContainerId = `1790_${Date.now()}`;
    const mockMediaId = `1805_${Date.now()}`;
    return {
      success: true,
      containerId: mockContainerId,
      mediaId: mockMediaId,
      permalink: `https://www.instagram.com/reel/C_${mockMediaId.slice(-8)}/`,
    };
  }

  // 2. Real Instagram Graph API Publishing Flow
  const baseUrl = getGraphBaseUrl(account.access_token);
  const localFilePath = path.join(UPLOADS_DIR, path.basename(post.video_filename));
  const hasLocalFile = fs.existsSync(localFilePath);

  try {
    let containerId = "";

    // Prefer Direct Resumable Binary Upload (rupload.facebook.com) when file is on local disk
    // so the user doesn't even need ngrok/S3/R2!
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

      if (post.thumb_offset_ms && post.thumb_offset_ms > 0 && post.media_type !== "STORIES") {
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

      // Upload raw binary bytes directly to Meta's rupload server
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
      // Fallback to public URL upload if file is hosted externally
      let resolvedVideoUrl = post.video_url;
      if (resolvedVideoUrl.startsWith("/")) {
        if (!publicBaseUrl || !publicBaseUrl.startsWith("http")) {
          return {
            success: false,
            error:
              "Video dosyası diskte bulunamadı (veya bir demo kaydı). Lütfen bilgisayarınızdan gerçek bir MP4 video dosyası yükleyip tekrar deneyin.",
          };
        }
        resolvedVideoUrl = `${publicBaseUrl.replace(/\/$/, "")}${resolvedVideoUrl}`;
      }

      const createParams = new URLSearchParams({
        media_type: post.media_type || "REELS",
        video_url: resolvedVideoUrl,
        access_token: account.access_token,
      });

      if (post.caption && post.media_type !== "STORIES") {
        createParams.set("caption", post.caption);
      }

      if (post.thumb_offset_ms && post.thumb_offset_ms > 0 && post.media_type !== "STORIES") {
        createParams.set("thumb_offset", String(Math.round(post.thumb_offset_ms)));
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
            "Instagram Media Container oluşturulamadı.",
        };
      }

      containerId = containerData.id;
    }

    // Step B: Poll Container Status until FINISHED (max ~120 seconds)
    let isReady = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      await sleep(5000);
      const statusRes = await fetch(
        `${baseUrl}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
          account.access_token
        )}`
      );
      const statusData = await statusRes.json();

      if (statusData.status_code === "FINISHED") {
        isReady = true;
        break;
      }

      if (
        statusData.status_code === "ERROR" ||
        statusData.status_code === "EXPIRED"
      ) {
        return {
          success: false,
          containerId,
          error: `Instagram video işleme hatası: ${
            statusData.status || statusData.status_code
          }`,
        };
      }
    }

    if (!isReady) {
      return {
        success: false,
        containerId,
        error:
          "Instagram video işleme süresi zaman aşımına uğradı (FINISHED bekleniyor).",
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
      // Permalink fetch is non-fatal
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

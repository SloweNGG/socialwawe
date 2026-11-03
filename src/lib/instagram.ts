import { InstagramAccount, ScheduledPost } from "./db";

export interface PublishResult {
  success: boolean;
  containerId?: string;
  mediaId?: string;
  permalink?: string;
  error?: string;
}

function getGraphBaseUrl(accessToken: string): string {
  // Tokens starting with IG... use graph.instagram.com (Instagram API with Instagram Login)
  // Tokens starting with EAA... use graph.facebook.com (Instagram Graph API with Facebook Login)
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

  // Resolve full public URL for the video so Meta servers can download it
  let resolvedVideoUrl = post.video_url;
  if (resolvedVideoUrl.startsWith("/")) {
    if (!publicBaseUrl || !publicBaseUrl.startsWith("http")) {
      return {
        success: false,
        error:
          "Instagram Graph API videoyu indirebilmek için herkese açık bir URL (Public Base URL / Cloudflare R2 / Ngrok) gerektirir. Lütfen Ayarlar > Meta API Kurulumu bölümünden Public URL girin.",
      };
    }
    resolvedVideoUrl = `${publicBaseUrl.replace(/\/$/, "")}${resolvedVideoUrl}`;
  }

  try {
    // Step A: Create Media Container
    const createParams = new URLSearchParams({
      media_type: post.media_type || "REELS",
      video_url: resolvedVideoUrl,
      access_token: account.access_token,
    });

    if (post.caption && post.media_type !== "STORIES") {
      createParams.set("caption", post.caption);
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

    const containerId: string = containerData.id;

    // Step B: Poll Container Status until FINISHED (max ~90 seconds)
    let isReady = false;
    for (let attempt = 0; attempt < 18; attempt++) {
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

      if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
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
        error: "Instagram video işleme süresi zaman aşımına uğradı (FINISHED bekleniyor).",
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
          publishData?.error?.message || "Instagram media_publish işlemi başarısız oldu.",
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


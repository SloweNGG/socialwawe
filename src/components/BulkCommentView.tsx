"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  RefreshCw,
  CheckSquare,
  Square,
  Send,
  Film,
  Layers,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Sparkles,
} from "lucide-react";
import CaptionTemplatesPicker from "./CaptionTemplatesPicker";
import HashtagGroupsPicker from "./HashtagGroupsPicker";

interface Account {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface IgMediaItem {
  id: string;
  caption?: string;
  media_type: "VIDEO" | "IMAGE" | "CAROUSEL_ALBUM";
  media_product_type?: "REELS" | "FEED" | "STORY";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  comments_count: number;
  like_count: number;
}

interface Props {
  accounts: Account[];
}

export default function BulkCommentView({ accounts }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );
  const [mediaList, setMediaList] = useState<IgMediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [loadingMedia, setLoadingMedia] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Selection state
  const [filterType, setFilterType] = useState<
    "ALL" | "REELS" | "CAROUSEL" | "NO_COMMENTS"
  >("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Comment Text & Sending state
  const [commentText, setCommentText] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [sending, setSending] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [itemStatus, setItemStatus] = useState<
    Record<string, { status: "pending" | "success" | "error"; msg?: string }>
  >({});

  const fetchMedia = useCallback(
    async (cursor?: string) => {
      const targetAcc = selectedAccountId || accounts[0]?.id;
      if (!targetAcc) return;

      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoadingMedia(true);
        setFetchError(null);
      }

      try {
        let url = `/api/comments?accountId=${encodeURIComponent(targetAcc)}`;
        if (cursor) {
          url += `&after=${encodeURIComponent(cursor)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setFetchError(data.error || "Gönderiler alınamadı.");
        } else {
          const incoming: IgMediaItem[] = data.media || [];
          if (cursor) {
            setMediaList((prev) => [...prev, ...incoming]);
          } else {
            setMediaList(incoming);
            // Default select all posts with 0 comments or all posts
            setSelectedIds(new Set(incoming.map((m) => m.id)));
          }
          setNextCursor(data.nextCursor || null);
          setHasNext(Boolean(data.hasNext));
        }
      } catch {
        setFetchError("Bağlantı hatası oluştu.");
      } finally {
        setLoadingMedia(false);
        setLoadingMore(false);
      }
    },
    [selectedAccountId, accounts]
  );

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
    fetchMedia();
  }, [fetchMedia, accounts, selectedAccountId]);

  const filteredMedia = mediaList.filter((item) => {
    if (filterType === "REELS") {
      return (
        item.media_type === "VIDEO" || item.media_product_type === "REELS"
      );
    }
    if (filterType === "CAROUSEL") {
      return (
        item.media_type === "CAROUSEL_ALBUM" || item.media_type === "IMAGE"
      );
    }
    if (filterType === "NO_COMMENTS") {
      return (item.comments_count || 0) === 0;
    }
    return true;
  });

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredMedia.map((m) => m.id)));
  };

  const selectZeroCommentPosts = () => {
    setSelectedIds(
      new Set(
        mediaList
          .filter((m) => (m.comments_count || 0) === 0)
          .map((m) => m.id)
      )
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkCommentSubmit = async () => {
    const targetAcc = selectedAccountId || accounts[0]?.id;
    const ids = Array.from(selectedIds);
    if (!targetAcc || ids.length === 0 || !commentText.trim()) return;

    setSending(true);
    setProgress({ done: 0, total: ids.length });

    const initialMap: Record<
      string,
      { status: "pending" | "success" | "error"; msg?: string }
    > = {};
    for (const id of ids) {
      initialMap[id] = { status: "pending" };
    }
    setItemStatus(initialMap);

    let completed = 0;
    for (let i = 0; i < ids.length; i++) {
      const mediaId = ids[i];
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: targetAcc,
            mediaId,
            message: commentText.trim(),
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setItemStatus((prev) => ({
            ...prev,
            [mediaId]: { status: "success", msg: "Yorum eklendi" },
          }));
          // Increment local comment counter
          setMediaList((prev) =>
            prev.map((m) =>
              m.id === mediaId
                ? { ...m, comments_count: (m.comments_count || 0) + 1 }
                : m
            )
          );
        } else {
          setItemStatus((prev) => ({
            ...prev,
            [mediaId]: {
              status: "error",
              msg: data.error || "Gönderilemedi",
            },
          }));
        }
      } catch {
        setItemStatus((prev) => ({
          ...prev,
          [mediaId]: { status: "error", msg: "Ağ hatası" },
        }));
      }

      completed++;
      setProgress({ done: completed, total: ids.length });

      // Wait between requests if more items remain
      if (i < ids.length - 1 && delaySeconds > 0) {
        await new Promise((r) => setTimeout(r, delaySeconds * 1000));
      }
    }

    setSending(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Comment Composer & Controls */}
      <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-5 h-fit">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-semibold mb-2">
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Resmi Instagram Comment API
          </div>
          <h2 className="text-lg font-bold text-white">
            Tüm Reels ve Gönderilere Toplu Yorum At
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Hesabınızdaki mevcut Reels, Carousel ve fotoğraf gönderilerini seçip hepsinin altına tek tıkla sabit yorum, çağrı metni veya hashtag grubu ekleyin.
          </p>
        </div>

        {/* Account Selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Instagram Hesabı
          </label>
          <div className="flex gap-2">
            <select
              value={selectedAccountId || accounts[0]?.id || ""}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fetchMedia()}
              disabled={loadingMedia || sending}
              className="px-3.5 py-2.5 rounded-xl bg-[#0b0d14] border border-white/10 hover:border-pink-500/40 text-xs font-semibold text-gray-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingMedia ? "animate-spin text-pink-400" : ""
                }`}
              />
              Yenile
            </button>
          </div>
        </div>

        {/* Comment Textarea + Templates + Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-300 font-medium">
              Gönderilerin Altına Yazılacak Yorum Metni *
            </label>
            <span className="text-[11px] text-gray-500">
              {commentText.length} / 2200
            </span>
          </div>
          <textarea
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Örn: Ücretsiz trading günlüğü ve backtest için profilimizdeki linke göz atın: wawejournal.com"
            className="w-full rounded-xl bg-[#0b0d14] border border-white/10 p-3.5 text-sm text-white focus:border-pink-500 focus:outline-none"
          />

          <CaptionTemplatesPicker
            currentCaption={commentText}
            onSelectTemplate={(tpl) =>
              setCommentText((prev) =>
                prev ? `${prev.trim()}\n\n${tpl}` : tpl
              )
            }
          />

          <HashtagGroupsPicker
            onSelectHashtags={(tags) =>
              setCommentText((prev) => (prev ? `${prev.trim()} ${tags}` : tags))
            }
          />
        </div>

        {/* Safe Delay Selector */}
        <div className="p-4 rounded-xl bg-[#0b0d14] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-pink-400" />
              Gönderiler Arası Güvenli Bekleme Süresi
            </span>
            <span className="text-xs font-bold text-pink-400">
              {delaySeconds} saniye
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            className="w-full accent-pink-500 cursor-pointer"
          />
          <p className="text-[11px] text-gray-500">
            Instagram spam korumasına takılmamak için her yorum arasında {delaySeconds} saniye beklenir.
          </p>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="p-4 rounded-xl bg-[#0b0d14] border border-pink-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                {sending
                  ? "Toplu yorumlar gönderiliyor..."
                  : "Toplu yorum işlemi tamamlandı!"}
              </span>
              <span className="font-bold text-pink-400">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-600 to-purple-600 transition-all duration-300"
                style={{
                  width: `${Math.round(
                    (progress.done / Math.max(1, progress.total)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={sending || selectedIds.size === 0 || !commentText.trim()}
          onClick={handleBulkCommentSubmit}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {sending
            ? `Yorumlar Gönderiliyor (${progress?.done}/${progress?.total})...`
            : `Seçili ${selectedIds.size} Gönderiye Toplu Yorum At`}
        </button>
      </div>

      {/* Right: Published Media Grid & Selection */}
      <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">
              Paylaşılmış Reels ve Gönderiler ({filteredMedia.length})
            </h3>
            <p className="text-xs text-gray-400">
              Yorum atmak istediğiniz gönderileri seçin ({selectedIds.size} seçili)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-2.5 py-1.5 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Tümünü Seç
            </button>
            <button
              type="button"
              onClick={selectZeroCommentPosts}
              className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              0 Yorum Olanları Seç
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Seçimi Kaldır
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "ALL", label: `Tümü (${mediaList.length})` },
              {
                id: "REELS",
                label: `Reels & Video (${
                  mediaList.filter((m) => m.media_type === "VIDEO").length
                })`,
              },
              {
                id: "CAROUSEL",
                label: `Carousel & Fotoğraf (${
                  mediaList.filter((m) => m.media_type !== "VIDEO").length
                })`,
              },
              {
                id: "NO_COMMENTS",
                label: `Yorumsuz Gönderiler (${
                  mediaList.filter((m) => (m.comments_count || 0) === 0).length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                filterType === tab.id
                  ? "bg-pink-600/20 border-pink-500 text-pink-200"
                  : "bg-[#0b0d14] border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {fetchError && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {fetchError}
          </div>
        )}

        {loadingMedia ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Instagram gönderileri yükleniyor...
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            Bu filtreye uygun gönderi bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredMedia.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const thumb = item.thumbnail_url || item.media_url;
              const statusObj = itemStatus[item.id];

              return (
                <div
                  key={item.id}
                  onClick={() => !sending && toggleSelectOne(item.id)}
                  className={`flex gap-3 p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-pink-500/[0.08] border-pink-500/50"
                      : "bg-[#0b0d14] border-white/10 hover:border-white/25"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-20 rounded-lg overflow-hidden bg-[#161926] shrink-0 relative border border-white/10">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="Media"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-bold text-white flex items-center gap-0.5">
                      {item.media_type === "VIDEO" ? (
                        <>
                          <Film className="w-2.5 h-2.5 text-pink-400" /> Reels
                        </>
                      ) : item.media_type === "CAROUSEL_ALBUM" ? (
                        <>
                          <Layers className="w-2.5 h-2.5 text-purple-400" />{" "}
                          Carousel
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-2.5 h-2.5 text-sky-400" />{" "}
                          Foto
                        </>
                      )}
                    </span>
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-400">
                          {new Date(item.timestamp).toLocaleDateString(
                            "tr-TR",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-400 hover:text-pink-400"
                            title="Instagram'da Aç"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-pink-500" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-gray-200 line-clamp-2 mt-1">
                        {item.caption || "(Açıklama yok)"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="w-3 h-3 text-pink-400" />
                          {item.like_count || 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-purple-400" />
                          {item.comments_count || 0} yorum
                        </span>
                      </div>

                      {statusObj && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            statusObj.status === "success"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : statusObj.status === "error"
                              ? "bg-red-500/15 text-red-300"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {statusObj.status === "success" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Eklendi
                            </>
                          ) : statusObj.status === "error" ? (
                            <>
                              <XCircle className="w-3 h-3" /> Hata
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> Bekliyor
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Pagination Button */}
        {hasNext && nextCursor && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => fetchMedia(nextCursor)}
              disabled={loadingMore}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              {loadingMore
                ? "Daha fazla yükleniyor..."
                : "Daha Eski Gönderileri Yükle"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Upload,
  Calendar,
  Clock,
  Sparkles,
  Trash2,
  CheckCircle2,
  Layers,
  Film,
  ShieldCheck,
} from "lucide-react";
import HashtagGroupsPicker from "./HashtagGroupsPicker";
import CaptionTemplatesPicker from "./CaptionTemplatesPicker";

interface Account {
  id: string;
  username: string;
  display_name: string;
  is_mock: number;
}

interface QueuedItem {
  tempId: string;
  file?: File;
  videoFilename: string;
  videoOriginalName: string;
  videoUrl: string;
  videoSizeBytes: number;
  caption: string;
  uploading: boolean;
  uploaded: boolean;
}

interface Props {
  accounts: Account[];
  onScheduled: () => void;
}

export default function BulkQueueView({ accounts, onScheduled }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );
  const [mediaType, setMediaType] = useState<"REELS" | "VIDEO" | "STORIES">("REELS");
  const [items, setItems] = useState<QueuedItem[]>([]);

  // Auto-distribution settings
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const [startDate, setStartDate] = useState<string>(tomorrowStr);
  const [frequency, setFrequency] = useState<
    "daily_1" | "daily_2" | "every_2_days" | "weekdays"
  >("daily_1");
  const [timeSlot1, setTimeSlot1] = useState<string>("19:00");
  const [timeSlot2, setTimeSlot2] = useState<string>("13:00");
  const [defaultThumbSec, setDefaultThumbSec] = useState<number>(1.0);
  const [sharedHashtags, setSharedHashtags] = useState<string>("");
  const [deleteAfterPublish, setDeleteAfterPublish] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList);
    const placeholders: QueuedItem[] = newFiles.map((file, idx) => {
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ");
      return {
        tempId: `tmp_${Date.now()}_${idx}`,
        file,
        videoFilename: file.name,
        videoOriginalName: file.name,
        videoUrl: "",
        videoSizeBytes: file.size,
        caption: `${cleanTitle} 🚀`,
        uploading: true,
        uploaded: false,
      };
    });

    setItems((prev) => [...prev, ...placeholders]);

    // Upload each file sequentially or in parallel to /api/upload
    for (const item of placeholders) {
      if (!item.file) continue;
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setItems((prev) =>
            prev.map((p) =>
              p.tempId === item.tempId
                ? {
                    ...p,
                    videoFilename: data.filename,
                    videoOriginalName: data.originalName,
                    videoUrl: data.videoUrl,
                    videoSizeBytes: data.sizeBytes,
                    uploading: false,
                    uploaded: true,
                  }
                : p
            )
          );
        } else {
          setItems((prev) =>
            prev.map((p) =>
              p.tempId === item.tempId ? { ...p, uploading: false } : p
            )
          );
        }
      } catch {
        setItems((prev) =>
          prev.map((p) =>
            p.tempId === item.tempId ? { ...p, uploading: false } : p
          )
        );
      }
    }
  };

  // Compute automatic scheduled timestamp for each item in queue
  const computeScheduledDate = (index: number): Date => {
    const base = new Date(`${startDate}T00:00:00`);
    if (isNaN(base.getTime())) return new Date();

    const applyTime = (d: Date, timeStr: string) => {
      const [hh, mm] = (timeStr || "19:00").split(":").map(Number);
      const copy = new Date(d);
      copy.setHours(hh || 19, mm || 0, 0, 0);
      return copy;
    };

    if (frequency === "daily_1") {
      const d = new Date(base);
      d.setDate(d.getDate() + index);
      return applyTime(d, timeSlot1);
    }

    if (frequency === "daily_2") {
      // 2 videos per day: even index gets slot2 (earlier), odd index gets slot1 (later)
      const dayOffset = Math.floor(index / 2);
      const d = new Date(base);
      d.setDate(d.getDate() + dayOffset);
      const slots = [timeSlot2, timeSlot1].sort();
      return applyTime(d, slots[index % 2]);
    }

    if (frequency === "every_2_days") {
      const d = new Date(base);
      d.setDate(d.getDate() + index * 2);
      return applyTime(d, timeSlot1);
    }

    // weekdays only (Mon-Fri)
    const d = new Date(base);
    let remaining = index;
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        remaining--;
      }
    }
    return applyTime(d, timeSlot1);
  };

  const handleSaveAll = async () => {
    if (!selectedAccountId && accounts[0]?.id) {
      setSelectedAccountId(accounts[0].id);
    }
    const targetAccount = selectedAccountId || accounts[0]?.id;
    if (!targetAccount) {
      setMessage("Lütfen önce bir Instagram hesabı seçin veya bağlayın.");
      return;
    }
    if (items.length === 0) {
      setMessage("Lütfen sıraya dizmek için en az 1 video seçin.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payloadItems = items.map((item, idx) => {
        const scheduledAt = computeScheduledDate(idx).toISOString();
        const fullCaption = sharedHashtags.trim()
          ? `${item.caption.trim()}\n\n${sharedHashtags.trim()}`
          : item.caption.trim();

        return {
          accountId: targetAccount,
          mediaType,
          videoFilename: item.videoFilename,
          videoOriginalName: item.videoOriginalName,
          videoUrl: item.videoUrl || `/api/videos/${item.videoFilename}`,
          videoSizeBytes: item.videoSizeBytes,
          caption: fullCaption,
          thumbOffsetMs: Math.round(defaultThumbSec * 1000),
          scheduledAt,
          deleteAfterPublish,
        };
      });

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });

      if (res.ok) {
        setItems([]);
        onScheduled();
      } else {
        const err = await res.json();
        setMessage(err.error || "Kayıt sırasında hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-[#121521] to-pink-950/30 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium mb-2">
              <Layers className="w-3.5 h-3.5" />
              Otomatik Sıraya Dizme Motoru (Auto-Queue)
            </div>
            <h2 className="text-xl font-bold text-white">
              Toplu Video Yükle & Günlere Otomatik Dağıt
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              10, 20 veya 30 videoyu tek seferde seçin; başlangıç gününü ve paylaşım saatini belirleyin, sistem hepsini sırayla takvime dizsin.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Distribution Rules */}
        <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-[#121521] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-pink-400" />
            1. Sıralama ve Dağıtım Kuralları
          </h3>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Hedef Instagram Hesabı
            </label>
            <select
              value={selectedAccountId || accounts[0]?.id || ""}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username} {acc.is_mock ? "(Test Modu)" : "(Resmi API)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                İçerik Formatı
              </label>
              <select
                value={mediaType}
                onChange={(e) =>
                  setMediaType(e.target.value as "REELS" | "VIDEO" | "STORIES")
                }
                className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
              >
                <option value="REELS">Reels Video</option>
                <option value="VIDEO">Normal Gönderi</option>
                <option value="STORIES">Hikaye (Story)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Paylaşım Sıklığı (Periyot)
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(
                  e.target.value as
                    | "daily_1"
                    | "daily_2"
                    | "every_2_days"
                    | "weekdays"
                )
              }
              className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            >
              <option value="daily_1">Her Gün 1 Video</option>
              <option value="daily_2">Her Gün 2 Video (Sabah / Akşam)</option>
              <option value="every_2_days">2 Günde 1 Video</option>
              <option value="weekdays">Sadece Hafta İçi (Pzt - Cuma)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                {frequency === "daily_2" ? "1. Paylaşım Saati" : "Paylaşım Saati"}
              </label>
              <input
                type="time"
                value={timeSlot1}
                onChange={(e) => setTimeSlot1(e.target.value)}
                className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
            {frequency === "daily_2" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  2. Paylaşım Saati
                </label>
                <input
                  type="time"
                  value={timeSlot2}
                  onChange={(e) => setTimeSlot2(e.target.value)}
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Varsayılan Kapak Karesi Saniyesi (İlk siyah ekranı atlamak için)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={defaultThumbSec}
                onChange={(e) => setDefaultThumbSec(Number(e.target.value))}
                className="w-24 rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
              />
              <span className="text-xs text-gray-400">
                saniye ({Math.round(defaultThumbSec * 1000)} ms)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Tüm Videolara Eklenecek Ortak Hashtag / Alt Metin
            </label>
            <textarea
              rows={2}
              value={sharedHashtags}
              onChange={(e) => setSharedHashtags(e.target.value)}
              placeholder="#reels #keşfet"
              className="w-full rounded-xl bg-[#0b0d14] border border-white/10 p-3 text-xs text-white focus:border-pink-500 focus:outline-none"
            />
            <CaptionTemplatesPicker
              currentCaption={sharedHashtags}
              onSelectTemplate={(tplContent) =>
                setSharedHashtags((prev) =>
                  prev ? `${prev.trim()}\n\n${tplContent}` : tplContent
                )
              }
            />

            <HashtagGroupsPicker
              onSelectHashtags={(tags) =>
                setSharedHashtags((prev) =>
                  prev ? `${prev.trim()} ${tags}` : tags
                )
              }
            />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteAfterPublish}
              onChange={(e) => setDeleteAfterPublish(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Yayınlandıktan sonra sunucudan sil
              </div>
              <p className="text-gray-400 mt-0.5">
                Her video Instagram&apos;da yayınlandığı anda dosyası otomatik silinir, depolama alanı dolmaz.
              </p>
            </div>
          </label>
        </div>

        {/* Step 2: Multi-file Dropzone & Auto-Assigned Schedule Table */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#121521] p-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                2. Videoları Seçin ve Otomatik Takvimi İnceleyin ({items.length} Video)
              </h3>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Listeyi Temizle
                </button>
              )}
            </div>

            {/* Dropzone */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-6 bg-[#0b0d14]/70 cursor-pointer transition group">
              <Upload className="w-8 h-8 text-pink-400 group-hover:scale-110 transition mb-2" />
              <span className="text-sm font-medium text-white">
                Birden Fazla Video Seçmek İçin Tıklayın (Çoklu Seçim)
              </span>
              <span className="text-xs text-gray-400 mt-1">
                MP4 veya MOV dosyalarını topluca seçebilirsiniz
              </span>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>

            {/* Queue Preview List */}
            {items.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Henüz video eklenmedi. Yukarıdaki alana tıklayarak birden fazla videoyu aynı anda seçebilirsiniz.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const assignedDate = computeScheduledDate(idx);
                  return (
                    <div
                      key={item.tempId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0b0d14] border border-white/10"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-300 flex items-center justify-center font-bold text-xs shrink-0">
                          #{idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-200 truncate">
                              {item.videoOriginalName}
                            </span>
                            <span className="text-[11px] text-gray-500 shrink-0">
                              ({(item.videoSizeBytes / (1024 * 1024)).toFixed(1)} MB)
                            </span>
                            {item.uploading ? (
                              <span className="text-[11px] text-amber-400">
                                Yükleniyor...
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-400 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Hazır
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={item.caption}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((prev) =>
                                prev.map((p) =>
                                  p.tempId === item.tempId
                                    ? { ...p, caption: val }
                                    : p
                                )
                              );
                            }}
                            placeholder="Bu video için açıklama..."
                            className="mt-1.5 w-full rounded-lg bg-[#121521] border border-white/10 px-2.5 py-1 text-xs text-white focus:border-pink-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-right">
                          <div className="text-[11px] text-purple-300 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {assignedDate.toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "short",
                              weekday: "short",
                            })}
                          </div>
                          <div className="text-xs font-bold text-white">
                            Saat{" "}
                            {assignedDate.toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((p) => p.tempId !== item.tempId)
                            )
                          }
                          className="p-2 text-gray-500 hover:text-red-400 transition"
                          title="Kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {message && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              {message}
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {items.length > 0 ? (
                <>
                  Toplam <strong className="text-white">{items.length} video</strong>{" "}
                  otomatik sıraya dizilmeye hazır.
                </>
              ) : (
                "Sıraya dizmek için dosyaları seçin."
              )}
            </div>
            <button
              onClick={handleSaveAll}
              disabled={
                saving ||
                items.length === 0 ||
                items.some((i) => i.uploading)
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm shadow-lg shadow-pink-600/20 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {saving
                ? "Takvime İşleniyor..."
                : `${items.length} Videoyu Otomatik Sırala & Kaydet`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import React, { useState } from "react";
import {
  Upload,
  Calendar,
  Clock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Film,
  Send,
  Hash,
} from "lucide-react";

interface Account {
  id: string;
  username: string;
  display_name: string;
  is_mock: number;
}

interface Props {
  accounts: Account[];
  onScheduled: () => void;
}

export default function SingleStudioView({ accounts, onScheduled }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );
  const [mediaType, setMediaType] = useState<"REELS" | "VIDEO" | "STORIES">(
    "REELS"
  );
  const [caption, setCaption] = useState<string>("");

  const defaultDateTime = (() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  })();

  const [scheduledAt, setScheduledAt] = useState<string>(defaultDateTime);
  const [deleteAfterPublish, setDeleteAfterPublish] = useState<boolean>(true);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{
    filename: string;
    originalName: string;
    sizeBytes: number;
    videoUrl: string;
    previewUrl: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setUploading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadedFile({
          filename: data.filename,
          originalName: data.originalName,
          sizeBytes: data.sizeBytes,
          videoUrl: data.videoUrl,
          previewUrl: localPreview,
        });
        if (!caption) {
          const cleanName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[_-]+/g, " ");
          setCaption(`${cleanName} 🔥\n\n#reels #keşfet #instagram`);
        }
      } else {
        setStatusMessage(data.error || "Video yüklenemedi.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleScheduleOrPublish = async (publishNow: boolean) => {
    const targetAccount = selectedAccountId || accounts[0]?.id;
    if (!targetAccount) {
      setStatusMessage("Lütfen önce bir Instagram hesabı seçin.");
      return;
    }
    if (!uploadedFile) {
      setStatusMessage("Lütfen önce bir video dosyası yükleyin.");
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const createRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: targetAccount,
          mediaType,
          videoFilename: uploadedFile.filename,
          videoOriginalName: uploadedFile.originalName,
          videoUrl: uploadedFile.videoUrl,
          videoSizeBytes: uploadedFile.sizeBytes,
          caption,
          scheduledAt: publishNow
            ? new Date().toISOString()
            : new Date(scheduledAt).toISOString(),
          deleteAfterPublish,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        setStatusMessage(createData.error || "Kaydedilemedi.");
        return;
      }

      if (publishNow && createData.createdIds?.[0]) {
        await fetch("/api/posts/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: createData.createdIds[0] }),
        });
      }

      onScheduled();
    } finally {
      setSubmitting(false);
    }
  };

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const quickHashtags = [
    "#reels #keşfet #viral #fyp",
    "#motivasyon #girişimcilik #başarı",
    "#mizah #komedi #eğlence #reelsvideo",
    "#teknoloji #yapayzeka #yazılım",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Form */}
      <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-pink-400" />
              Tekli Video Yükle & Zamanla
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Videonuzu yükleyin, açıklamasını ve yayınlanacağı tarih/saati seçin.
            </p>
          </div>
        </div>

        {/* Account & Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Paylaşılacak Instagram Hesabı
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

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Paylaşım Türü
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["REELS", "VIDEO", "STORIES"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaType(t)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                    mediaType === t
                      ? "bg-pink-600/20 border-pink-500 text-pink-200"
                      : "bg-[#0b0d14] border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "REELS" ? "Reels" : t === "VIDEO" ? "Gönderi" : "Hikaye"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Video File Upload */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Video Dosyası (MP4 / MOV)
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-6 bg-[#0b0d14]/70 cursor-pointer transition">
            {uploading ? (
              <span className="text-sm text-amber-400 font-medium">
                Video sunucuya yükleniyor...
              </span>
            ) : uploadedFile ? (
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">
                    {uploadedFile.originalName}
                  </div>
                  <div className="text-xs text-gray-400">
                    {(uploadedFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB •
                    Değiştirmek için tıklayın
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-pink-400 mb-2" />
                <span className="text-sm font-medium text-white">
                  Bilgisayardan veya Telefondan Video Seçin
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  9:16 Dikey Reels videoları önerilir (Maks. 500 MB)
                </span>
              </>
            )}
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Caption & Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-400">
              Video Açıklaması (Caption) & Hashtag&apos;ler
            </label>
            <span className="text-[11px] text-gray-500">
              {caption.length} / 2200 karakter
            </span>
          </div>
          <textarea
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Videonuz için açıklama ve etiketleri yazın..."
            className="w-full rounded-xl bg-[#0b0d14] border border-white/10 p-3.5 text-sm text-white focus:border-pink-500 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] text-gray-500 flex items-center gap-1 mr-1">
              <Hash className="w-3 h-3" /> Hızlı Etiket:
            </span>
            {quickHashtags.map((tagGroup, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  setCaption((prev) =>
                    prev ? `${prev.trim()}\n${tagGroup}` : tagGroup
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0d14] border border-white/10 hover:border-pink-500/40 text-gray-300 transition"
              >
                + {tagGroup.split(" ").slice(0, 2).join(" ")}...
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Date/Time & Auto-Delete Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-[#0b0d14] border border-white/10">
            <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-pink-400" />
              Paylaşım Gün ve Saati
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteAfterPublish}
              onChange={(e) => setDeleteAfterPublish(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 text-emerald-500"
            />
            <div className="text-xs">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Yayınlandıktan sonra sunucudan sil
              </div>
              <p className="text-gray-400 mt-1">
                Video Instagram&apos;a yüklendikten hemen sonra sunucudan otomatik silinir.
              </p>
            </div>
          </label>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {statusMessage}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={submitting || uploading}
            onClick={() => handleScheduleOrPublish(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Beklemeden Şimdi Yayınla
          </button>

          <button
            type="button"
            disabled={submitting || uploading}
            onClick={() => handleScheduleOrPublish(false)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white text-sm font-semibold shadow-lg shadow-pink-600/20 transition cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            {submitting ? "Kaydediliyor..." : "Seçilen Tarihe Zamanla"}
          </button>
        </div>
      </div>

      {/* Right Phone Mockup Preview */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col items-center justify-center">
        <div className="w-[290px] h-[560px] rounded-[38px] border-[6px] border-[#222638] bg-[#06070b] shadow-2xl overflow-hidden relative flex flex-col justify-between">
          {/* Top Notch */}
          <div className="absolute top-2 inset-x-0 flex justify-center z-20">
            <div className="w-24 h-4 rounded-full bg-black/80 border border-white/10" />
          </div>

          {/* Video Area */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-[#121521] to-black flex items-center justify-center">
            {uploadedFile?.previewUrl ? (
              <video
                src={uploadedFile.previewUrl}
                controls
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6">
                <Sparkles className="w-8 h-8 text-pink-500/50 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  Video seçtiğinizde burada canlı Instagram Reels önizlemesi görünür.
                </p>
              </div>
            )}
          </div>

          {/* Overlay Top */}
          <div className="relative z-10 p-4 pt-7 flex items-center justify-between text-xs font-bold text-white drop-shadow">
            <span>Reels</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/50 backdrop-blur">
              {mediaType}
            </span>
          </div>

          {/* Overlay Bottom Caption */}
          <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600" />
              <span className="text-xs font-bold text-white">
                @{activeAccount?.username || "instagram"}
              </span>
            </div>
            <p className="text-[11px] text-gray-200 line-clamp-3 whitespace-pre-wrap">
              {caption || "Video açıklaması burada görünecek..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


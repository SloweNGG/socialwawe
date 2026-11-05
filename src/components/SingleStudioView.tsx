"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Calendar,
  Clock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Film,
  Video,
  Zap,
  Send,
  Image as ImageIcon,
  Scissors,
  Download,
  Layers,
  Trash2,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Music2,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Battery,
  Camera,
} from "lucide-react";
import HashtagGroupsPicker from "./HashtagGroupsPicker";
import CaptionTemplatesPicker from "./CaptionTemplatesPicker";

interface Account {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_mock: number;
}

interface Props {
  accounts: Account[];
  onScheduled: () => void;
}

type StudioFormat = "REELS" | "CAROUSEL" | "IMAGE" | "VIDEO" | "STORIES";
type CarouselSubMode = "splitter" | "multi_upload";
type AspectPreset = "4:5" | "3:4" | "1:1" | "9:16";
type FitMode = "cover" | "contain" | "stretch";
type SplitDirection = "horizontal" | "vertical";

const ASPECT_DIMENSIONS: Record<
  AspectPreset,
  { width: number; height: number; label: string }
> = {
  "4:5": {
    width: 1080,
    height: 1350,
    label: "4:5 Dikey Portre (1080×1350 - Standart)",
  },
  "3:4": {
    width: 1080,
    height: 1440,
    label: "3:4 Yeni Izgara (1080×1440)",
  },
  "1:1": {
    width: 1080,
    height: 1080,
    label: "1:1 Kare (1080×1080)",
  },
  "9:16": {
    width: 1080,
    height: 1920,
    label: "9:16 Tam Ekran (1080×1920)",
  },
};

interface GeneratedSlide {
  index: number;
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

interface MultiUploadedSlide {
  id: string;
  filename: string;
  originalName: string;
  previewUrl: string;
  sizeBytes: number;
}

export default function SingleStudioView({ accounts, onScheduled }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ""
  );
  const [mediaType, setMediaType] = useState<StudioFormat>("REELS");
  const [caption, setCaption] = useState<string>("");

  // Video / Single Media state
  const [thumbOffsetSec, setThumbOffsetSec] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(30);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{
    filename: string;
    originalName: string;
    sizeBytes: number;
    videoUrl: string;
    previewUrl: string;
  } | null>(null);

  // Carousel Mode state (Splitter + Multi-Photo Upload in one place)
  const [carouselSubMode, setCarouselSubMode] =
    useState<CarouselSubMode>("splitter");
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [slideCount, setSlideCount] = useState<number>(3);
  const [aspect, setAspect] = useState<AspectPreset>("4:5");
  const [direction, setDirection] = useState<SplitDirection>("horizontal");
  const [fitMode, setFitMode] = useState<FitMode>("cover");
  const [bgColor, setBgColor] = useState<string>("#090a0f");
  const [panOffset, setPanOffset] = useState<number>(50);
  const [slides, setSlides] = useState<GeneratedSlide[]>([]);
  const [activeSwipeIdx, setActiveSwipeIdx] = useState<number>(0);

  // Multi-image upload state for standard carousel
  const [multiSlides, setMultiSlides] = useState<MultiUploadedSlide[]>([]);

  const defaultDateTime = (() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  })();

  const [scheduledAt, setScheduledAt] = useState<string>(defaultDateTime);
  const [deleteAfterPublish, setDeleteAfterPublish] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Slice panoramic image whenever splitter settings change
  useEffect(() => {
    if (!sourceImage) {
      setSlides([]);
      return;
    }

    const tile = ASPECT_DIMENSIONS[aspect];
    const totalW =
      direction === "horizontal" ? tile.width * slideCount : tile.width;
    const totalH =
      direction === "vertical" ? tile.height * slideCount : tile.height;

    const masterCanvas = document.createElement("canvas");
    masterCanvas.width = totalW;
    masterCanvas.height = totalH;
    const ctx = masterCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalW, totalH);

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;

    if (fitMode === "stretch") {
      ctx.drawImage(sourceImage, 0, 0, totalW, totalH);
    } else if (fitMode === "contain") {
      const scale = Math.min(totalW / imgW, totalH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const offsetX = (totalW - drawW) * (panOffset / 100);
      const offsetY = (totalH - drawH) * (panOffset / 100);
      ctx.drawImage(sourceImage, offsetX, offsetY, drawW, drawH);
    } else {
      const scale = Math.max(totalW / imgW, totalH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const offsetX = (totalW - drawW) * (panOffset / 100);
      const offsetY = (totalH - drawH) * (panOffset / 100);
      ctx.drawImage(sourceImage, offsetX, offsetY, drawW, drawH);
    }

    const buildSlides = async () => {
      const generated: GeneratedSlide[] = [];
      for (let i = 0; i < slideCount; i++) {
        const slideCanvas = document.createElement("canvas");
        slideCanvas.width = tile.width;
        slideCanvas.height = tile.height;
        const sCtx = slideCanvas.getContext("2d");
        if (!sCtx) continue;

        const srcX = direction === "horizontal" ? i * tile.width : 0;
        const srcY = direction === "vertical" ? i * tile.height : 0;

        sCtx.drawImage(
          masterCanvas,
          srcX,
          srcY,
          tile.width,
          tile.height,
          0,
          0,
          tile.width,
          tile.height
        );

        const dataUrl = slideCanvas.toDataURL("image/jpeg", 0.95);
        const blob: Blob = await new Promise((resolve) =>
          slideCanvas.toBlob(
            (b) => resolve(b || new Blob()),
            "image/jpeg",
            0.95
          )
        );

        generated.push({
          index: i + 1,
          dataUrl,
          blob,
          width: tile.width,
          height: tile.height,
        });
      }
      setSlides(generated);
    };

    buildSlides();
  }, [sourceImage, slideCount, aspect, direction, fitMode, bgColor, panOffset]);

  const handleSingleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setUploading(true);
    setStatusMessage(null);
    setThumbOffsetSec(0);

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
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Dosya yüklenemedi.",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSplitterImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFileName(file.name.replace(/\.[^/.]+$/, ""));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setActiveSwipeIdx(0);
      setStatusMessage(null);
    };
    img.src = url;
  };

  const handleMultiCarouselUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatusMessage(null);

    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const previewUrl = URL.createObjectURL(file);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (res.ok) {
          setMultiSlides((prev) =>
            [
              ...prev,
              {
                id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                filename: data.filename,
                originalName: data.originalName,
                previewUrl,
                sizeBytes: data.sizeBytes,
              },
            ].slice(0, 10)
          );
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const downloadSingleSlide = (slide: GeneratedSlide) => {
    const a = document.createElement("a");
    a.href = slide.dataUrl;
    a.download = `${sourceFileName || "carousel"}_slide_${slide.index}.jpg`;
    a.click();
  };

  const downloadAllSlides = () => {
    slides.forEach((slide, i) => {
      setTimeout(() => downloadSingleSlide(slide), i * 180);
    });
  };

  const handleThumbSliderChange = (sec: number) => {
    setThumbOffsetSec(sec);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = sec;
    }
  };

  const handleCaptureCurrentFrame = () => {
    if (videoRef.current) {
      const current = Number(videoRef.current.currentTime.toFixed(1));
      setThumbOffsetSec(current);
      videoRef.current.pause();
    }
  };

  const handleScheduleOrPublish = async (publishNow: boolean) => {
    const targetAccount = selectedAccountId || accounts[0]?.id;
    if (!targetAccount) {
      setStatusMessage({
        type: "error",
        text: "Lütfen önce bir Instagram hesabı seçin.",
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage({
      type: "info",
      text: publishNow
        ? "Instagram'a yükleniyor ve yayınlanıyor, lütfen bekleyin..."
        : "Takvime kaydediliyor...",
    });

    try {
      // CASE 1: CAROUSEL (Either from Panorama Splitter or Multi-Image Upload)
      if (mediaType === "CAROUSEL") {
        let uploadedFilenames: string[] = [];
        let totalBytes = 0;
        let displayTitle = "Carousel Gönderi";

        if (carouselSubMode === "splitter") {
          if (slides.length < 2) {
            setStatusMessage({
              type: "error",
              text: "Lütfen önce bölünecek bir görsel seçin.",
            });
            setSubmitting(false);
            return;
          }

          for (const slide of slides) {
            const form = new FormData();
            const fileName = `${sourceFileName || "carousel"}_part_${slide.index}.jpg`;
            form.append("file", slide.blob, fileName);

            const upRes = await fetch("/api/upload", {
              method: "POST",
              body: form,
            });
            const upData = await upRes.json();
            if (!upRes.ok || !upData.filename) {
              throw new Error(
                upData.error || `Parça ${slide.index} yüklenemedi.`
              );
            }
            uploadedFilenames.push(upData.filename);
            totalBytes += Number(upData.sizeBytes || slide.blob.size);
          }
          displayTitle = `${sourceFileName || "Carousel"} (${slides.length} Parça Bölünmüş)`;
        } else {
          if (multiSlides.length < 2) {
            setStatusMessage({
              type: "error",
              text: "Kaydırmalı gönderi için en az 2 fotoğraf yüklemelisiniz.",
            });
            setSubmitting(false);
            return;
          }
          uploadedFilenames = multiSlides.map((m) => m.filename);
          totalBytes = multiSlides.reduce((acc, m) => acc + m.sizeBytes, 0);
          displayTitle = `Kaydırmalı Gönderi (${multiSlides.length} Fotoğraf)`;
        }

        const createRes = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: targetAccount,
            mediaType: "CAROUSEL",
            videoFilename: uploadedFilenames[0],
            videoOriginalName: displayTitle,
            videoUrl: `/api/videos/${uploadedFilenames[0]}`,
            videoSizeBytes: totalBytes,
            carouselFiles: uploadedFilenames,
            caption,
            scheduledAt: publishNow
              ? new Date().toISOString()
              : new Date(scheduledAt).toISOString(),
            deleteAfterPublish,
          }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
          setStatusMessage({
            type: "error",
            text: createData.error || "Carousel kaydedilemedi.",
          });
          return;
        }

        if (publishNow && createData.createdIds?.[0]) {
          const pubRes = await fetch("/api/posts/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: createData.createdIds[0] }),
          });
          const pubData = await pubRes.json();
          if (!pubRes.ok) {
            setStatusMessage({
              type: "error",
              text: pubData.error || "Instagram yayınlama hatası.",
            });
            return;
          }
          setStatusMessage({
            type: "success",
            text: "Kaydırmalı (Carousel) gönderi Instagram'da başarıyla yayınlandı!",
          });
        } else {
          setStatusMessage({
            type: "success",
            text: "Kaydırmalı (Carousel) gönderi seçilen tarihe zamanlandı!",
          });
        }

        onScheduled();
        return;
      }

      // CASE 2: SINGLE REELS / PHOTO / VIDEO / STORY
      if (!uploadedFile) {
        setStatusMessage({
          type: "error",
          text: "Lütfen önce bir medya dosyası seçin.",
        });
        setSubmitting(false);
        return;
      }

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
          thumbOffsetMs: Math.round(thumbOffsetSec * 1000),
          scheduledAt: publishNow
            ? new Date().toISOString()
            : new Date(scheduledAt).toISOString(),
          deleteAfterPublish,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        setStatusMessage({
          type: "error",
          text: createData.error || "Kaydedilemedi.",
        });
        return;
      }

      if (publishNow && createData.createdIds?.[0]) {
        const pubRes = await fetch("/api/posts/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: createData.createdIds[0] }),
        });
        const pubData = await pubRes.json();
        if (!pubRes.ok) {
          setStatusMessage({
            type: "error",
            text: pubData.error || "Instagram yayınlama hatası.",
          });
          return;
        }
        setStatusMessage({
          type: "success",
          text: "İçerik Instagram'da başarıyla yayınlandı!",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "İçerik seçilen tarihe başarıyla zamanlandı!",
        });
      }

      onScheduled();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const tileInfo = ASPECT_DIMENSIONS[aspect];
  const totalCanvasWidth =
    direction === "horizontal" ? tileInfo.width * slideCount : tileInfo.width;
  const totalCanvasHeight =
    direction === "vertical" ? tileInfo.height * slideCount : tileInfo.height;

  // Determine active preview slides for the right phone mockup when in CAROUSEL mode
  const previewCarouselUrls =
    carouselSubMode === "splitter"
      ? slides.map((s) => s.dataUrl)
      : multiSlides.map((m) => m.previewUrl);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left All-in-One Studio Form */}
      <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-pink-400" />
              Hepsi Bir Arada Paylaşım & Carousel Stüdyosu
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Reels, Tekli Fotoğraf, Kaydırmalı Görsel Bölücü (Carousel Splitter), Video ve Hikayelerinizi tek ekrandan hazırlayıp paylaşın.
            </p>
          </div>
        </div>

        {/* Account & Format Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="block text-xs text-gray-400 mb-1.5">
              Instagram Hesabı
            </label>
            <select
              value={selectedAccountId || accounts[0]?.id || ""}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-8">
            <label className="block text-xs text-gray-400 mb-1.5">
              Paylaşım Formatı Seçin
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: "REELS", label: "Reels", Icon: Film },
                  { id: "CAROUSEL", label: "Carousel / Bölücü", Icon: Scissors },
                  { id: "IMAGE", label: "Fotoğraf", Icon: ImageIcon },
                  { id: "VIDEO", label: "Video", Icon: Video },
                  { id: "STORIES", label: "Hikaye", Icon: Zap },
                ] as const
              ).map((t) => {
                const IconComp = t.Icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setMediaType(t.id);
                      setStatusMessage(null);
                    }}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      mediaType === t.id
                        ? "bg-pink-600/20 border-pink-500 text-pink-200 shadow-sm"
                        : "bg-[#0b0d14] border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* CONDITIONAL SECTION A: CAROUSEL & IMAGE SPLITTER                    */}
        {/* =================================================================== */}
        {mediaType === "CAROUSEL" ? (
          <div className="p-5 rounded-2xl bg-[#0b0d14] border border-pink-500/25 space-y-5">
            {/* Submode Switcher: Panorama Splitter vs Multi-Photo Upload */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-bold text-white">
                  Kaydırmalı Gönderi (Carousel) Modu
                </span>
              </div>

              <div className="flex rounded-xl bg-[#121521] p-1 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setCarouselSubMode("splitter")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition inline-flex items-center gap-1.5 cursor-pointer ${
                    carouselSubMode === "splitter"
                      ? "bg-pink-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Tek Görseli Parçalara Böl (ImgShifter)
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselSubMode("multi_upload")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition inline-flex items-center gap-1.5 cursor-pointer ${
                    carouselSubMode === "multi_upload"
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Birden Fazla Fotoğraf Seç (2-10)
                </button>
              </div>
            </div>

            {carouselSubMode === "splitter" ? (
              <div className="space-y-4">
                {/* Upload Panoramic Image */}
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-5 bg-[#121521]/70 cursor-pointer transition">
                  <Upload className="w-7 h-7 text-pink-400 mb-1.5" />
                  <span className="text-sm font-semibold text-white">
                    {sourceImage
                      ? `${sourceFileName} (${sourceImage.naturalWidth}×${sourceImage.naturalHeight} px)`
                      : "Bölünecek Geniş / Panoramik Görseli Seçin"}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">
                    PNG, JPG veya WEBP — Seçtiğiniz anda otomatik parçalara bölünür
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSplitterImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Slide Count & Aspect Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-gray-300 font-medium">
                        Kaç Parçaya (Slide) Bölünsün?
                      </label>
                      <span className="text-[11px] font-bold text-pink-400">
                        {slideCount} Parça ({totalCanvasWidth}×{totalCanvasHeight})
                      </span>
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setSlideCount(num);
                            setActiveSwipeIdx(0);
                          }}
                          className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            slideCount === num
                              ? "bg-pink-600 border-pink-400 text-white"
                              : "bg-[#121521] border-white/10 text-gray-400 hover:text-white"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-300 font-medium mb-1.5">
                      Instagram Boyut Oranı (Aspect Ratio)
                    </label>
                    <select
                      value={aspect}
                      onChange={(e) =>
                        setAspect(e.target.value as AspectPreset)
                      }
                      className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                    >
                      {Object.entries(ASPECT_DIMENSIONS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Direction, Fit Mode & Pan Offset */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Bölme Yönü
                    </label>
                    <select
                      value={direction}
                      onChange={(e) =>
                        setDirection(e.target.value as SplitDirection)
                      }
                      className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white"
                    >
                      <option value="horizontal">
                        Yatay (Yan Yana Kaydırmalı)
                      </option>
                      <option value="vertical">Dikey (Alt Alta)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Sığdırma Modu
                    </label>
                    <select
                      value={fitMode}
                      onChange={(e) => setFitMode(e.target.value as FitMode)}
                      className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white"
                    >
                      <option value="cover">
                        Tam Doldur / Kesintisiz (Cover)
                      </option>
                      <option value="contain">Kırpmadan Ortala (Contain)</option>
                      <option value="stretch">Tam Esnet (Stretch)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Hizalama (%{panOffset})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={panOffset}
                      onChange={(e) => setPanOffset(Number(e.target.value))}
                      className="w-full accent-pink-500 mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Live Seamless Split Grid & Download Buttons */}
                {slides.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-200">
                        Bölünen Parçalar ({slides.length} Adet • {tileInfo.width}×
                        {tileInfo.height} px):
                      </span>
                      <button
                        type="button"
                        onClick={downloadAllSlides}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Tüm Parçaları Bilgisayara İndir ({slides.length} JPG)
                      </button>
                    </div>

                    <div
                      className={`grid gap-2 ${
                        direction === "horizontal"
                          ? "grid-flow-col auto-cols-fr"
                          : "grid-cols-2 sm:grid-cols-4"
                      }`}
                    >
                      {slides.map((s, idx) => (
                        <div
                          key={s.index}
                          onClick={() => setActiveSwipeIdx(idx)}
                          className={`relative rounded-xl overflow-hidden border-2 cursor-pointer group transition ${
                            activeSwipeIdx === idx
                              ? "border-pink-500 ring-2 ring-pink-500/30"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <img
                            src={s.dataUrl}
                            alt={`Slide ${s.index}`}
                            className="w-full h-auto block"
                          />
                          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white">
                            #{s.index}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadSingleSlide(s);
                            }}
                            className="absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-black/80 hover:bg-pink-600 text-white text-[10px] flex items-center gap-1"
                            title="Bu parçayı indir"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Multi-Photo Upload Mode */
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-5 bg-[#121521]/70 cursor-pointer transition">
                  <Layers className="w-7 h-7 text-purple-400 mb-1.5" />
                  <span className="text-sm font-semibold text-white">
                    Kaydırmalı Gönderi İçin 2 ila 10 Fotoğraf Seçin
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5">
                    Birden fazla JPG / PNG dosyasını aynı anda seçebilirsiniz
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultiCarouselUpload}
                    className="hidden"
                  />
                </label>

                {multiSlides.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {multiSlides.map((m, idx) => (
                      <div
                        key={m.id}
                        onClick={() => setActiveSwipeIdx(idx)}
                        className={`relative rounded-xl overflow-hidden border-2 cursor-pointer ${
                          activeSwipeIdx === idx
                            ? "border-purple-500"
                            : "border-white/10"
                        }`}
                      >
                        <img
                          src={m.previewUrl}
                          alt={m.originalName}
                          className="w-full h-24 object-cover"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMultiSlides((prev) =>
                              prev.filter((item) => item.id !== m.id)
                            );
                          }}
                          className="absolute top-1 right-1 p-1 rounded bg-black/75 text-red-400 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* =================================================================== */
          /* CONDITIONAL SECTION B: SINGLE REELS / PHOTO / VIDEO / STORY         */
          /* =================================================================== */
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                {mediaType === "IMAGE"
                  ? "Fotoğraf Dosyası (JPG / PNG / WEBP)"
                  : mediaType === "STORIES"
                  ? "Hikaye Dosyası (Video MP4 veya Fotoğraf JPG/PNG)"
                  : "Video Dosyası (MP4 / MOV)"}
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-6 bg-[#0b0d14]/70 cursor-pointer transition">
                {uploading ? (
                  <span className="text-sm text-amber-400 font-medium">
                    Dosya sunucuya yükleniyor...
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
                      {mediaType === "IMAGE"
                        ? "Bilgisayardan veya Telefondan Fotoğraf Seçin"
                        : "Bilgisayardan veya Telefondan Medya Seçin"}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {mediaType === "IMAGE"
                        ? "JPG, PNG veya WEBP (4:5 veya 1:1 önerilir)"
                        : "9:16 Dikey Reels veya Gönderi (Maks. 500 MB)"}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept={
                    mediaType === "IMAGE"
                      ? "image/*"
                      : mediaType === "STORIES"
                      ? "video/*,image/*"
                      : "video/*"
                  }
                  onChange={handleSingleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Thumbnail (Cover Frame) Selector for Videos */}
            {uploadedFile &&
              mediaType !== "STORIES" &&
              mediaType !== "IMAGE" &&
              !uploadedFile.originalName.match(/\.(jpg|jpeg|png|webp)$/i) && (
                <div className="p-4 rounded-2xl bg-[#0b0d14] border border-pink-500/25 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-pink-400" />
                      <span className="text-xs font-bold text-white">
                        Reels Kapak Karesi (Thumbnail) Saniyesi
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/30">
                        {thumbOffsetSec.toFixed(1)}. Saniye (
                        {Math.round(thumbOffsetSec * 1000)} ms)
                      </span>
                      <button
                        type="button"
                        onClick={handleCaptureCurrentFrame}
                        className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-pink-400" />
                        Önizlemedeki Anlık Kareyi Seç
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, Number(videoDuration.toFixed(1)))}
                      step={0.1}
                      value={thumbOffsetSec}
                      onChange={(e) =>
                        handleThumbSliderChange(Number(e.target.value))
                      }
                      className="w-full accent-pink-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>0.0 sn (Başlangıç)</span>
                      <span>
                        Kaydırıcıyı hareket ettirerek sağdaki telefonda kapak karesini görün
                      </span>
                      <span>{videoDuration.toFixed(1)} sn (Bitiş)</span>
                    </div>
                  </div>
                </div>
              )}
          </>
        )}

        {/* Caption & Hashtag Groups (Shared across all formats) */}
        {mediaType !== "STORIES" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400">
                Gönderi Açıklaması (Caption) & Etiket Grupları
              </label>
              <span className="text-[11px] text-gray-500">
                {caption.length} / 2200 karakter
              </span>
            </div>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Gönderiniz için açıklama ve etiketleri yazın..."
              className="w-full rounded-xl bg-[#0b0d14] border border-white/10 p-3.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            />

            <CaptionTemplatesPicker
              currentCaption={caption}
              onSelectTemplate={(tplContent) =>
                setCaption((prev) =>
                  prev ? `${prev.trim()}\n\n${tplContent}` : tplContent
                )
              }
            />

            <HashtagGroupsPicker
              onSelectHashtags={(tags) =>
                setCaption((prev) => (prev ? `${prev.trim()}\n${tags}` : tags))
              }
            />
          </div>
        )}

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
                Medya Instagram&apos;a yüklendikten hemen sonra sunucudan otomatik silinir.
              </p>
            </div>
          </label>
        </div>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : statusMessage.type === "error"
                ? "bg-red-500/15 border-red-500/30 text-red-300"
                : "bg-pink-500/15 border-pink-500/30 text-pink-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : statusMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
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
            {submitting ? "İşleniyor..." : "Seçilen Tarihe Zamanla"}
          </button>
        </div>
      </div>

      {/* Right Realistic iPhone + Instagram Native UI Preview */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col items-center justify-start space-y-3">
        <div className="text-xs font-semibold text-gray-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          Canlı Instagram {mediaType === "CAROUSEL" ? "Carousel" : mediaType === "IMAGE" ? "Gönderi" : mediaType === "STORIES" ? "Hikaye" : "Reels"} Önizlemesi
        </div>

        {/* Outer Titanium iPhone Frame */}
        <div className="relative p-[10px] rounded-[50px] bg-gradient-to-b from-[#34394f] via-[#1c2030] to-[#2a2f45] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),0_0_30px_rgba(236,72,153,0.12)] border border-white/15">
          {/* Side Hardware Buttons */}
          <div className="absolute -left-[3px] top-24 w-[3px] h-7 bg-[#424863] rounded-l-md" />
          <div className="absolute -left-[3px] top-36 w-[3px] h-12 bg-[#424863] rounded-l-md" />
          <div className="absolute -left-[3px] top-52 w-[3px] h-12 bg-[#424863] rounded-l-md" />
          <div className="absolute -right-[3px] top-40 w-[3px] h-16 bg-[#424863] rounded-r-md" />

          {/* Inner OLED Screen */}
          <div className="w-[310px] h-[630px] rounded-[41px] bg-[#050608] overflow-hidden relative flex flex-col justify-between select-none border border-black">
            {/* iOS Status Bar + Dynamic Island */}
            <div className="relative z-30 pt-3 px-6 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-white">
              <span className="tracking-tight">09:41</span>
              <div className="w-24 h-[22px] rounded-full bg-black border border-white/[0.08] flex items-center justify-end pr-2 shadow-inner">
                <div className="w-2.5 h-2.5 rounded-full bg-[#121629] ring-1 ring-indigo-500/30" />
              </div>
              <div className="flex items-center gap-1.5 text-white/90">
                <Wifi className="w-3.5 h-3.5" />
                <Battery className="w-4 h-4" />
              </div>
            </div>

            {/* =============================================================== */}
            {/* LAYOUT 1: FEED POST / CAROUSEL (Instagram Feed Native Look)     */}
            {/* =============================================================== */}
            {mediaType === "CAROUSEL" || mediaType === "IMAGE" ? (
              <div className="flex-1 flex flex-col justify-between bg-[#08090d] z-10 overflow-hidden">
                {/* IG Post Header */}
                <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/[0.07]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600">
                      {activeAccount?.avatar_url ? (
                        <img
                          src={activeAccount.avatar_url}
                          alt={activeAccount.username}
                          className="w-7 h-7 rounded-full object-cover bg-black border border-black"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#181b28] flex items-center justify-center text-[10px] font-bold text-white">
                          {(activeAccount?.username || "W")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-none flex items-center gap-1">
                        {activeAccount?.username || "wawejournal"}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Orijinal Gönderi
                      </div>
                    </div>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </div>

                {/* IG Post Media Frame */}
                <div className="relative flex-1 bg-[#0d1018] flex items-center justify-center overflow-hidden">
                  {mediaType === "CAROUSEL" ? (
                    previewCarouselUrls.length > 0 ? (
                      <>
                        <img
                          src={
                            previewCarouselUrls[activeSwipeIdx] ||
                            previewCarouselUrls[0]
                          }
                          alt="Carousel Slide"
                          className="w-full h-full object-contain"
                        />
                        {/* Slide Counter Pill */}
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                          {activeSwipeIdx + 1}/{previewCarouselUrls.length}
                        </div>
                        {/* Prev/Next Arrows */}
                        {activeSwipeIdx > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSwipeIdx((prev) => Math.max(0, prev - 1))
                            }
                            className="absolute left-2.5 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/15 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}
                        {activeSwipeIdx < previewCarouselUrls.length - 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSwipeIdx((prev) =>
                                Math.min(previewCarouselUrls.length - 1, prev + 1)
                              )
                            }
                            className="absolute right-2.5 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/15 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="p-6 text-center space-y-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto">
                          <Scissors className="w-6 h-6 text-pink-400" />
                        </div>
                        <div className="text-xs font-semibold text-gray-200">
                          Kaydırmalı (Carousel) Önizleme
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Sol taraftan geniş bir görsel seçtiğinizde kesintisiz kaydırmalı önizleme burada belirecek.
                        </p>
                      </div>
                    )
                  ) : uploadedFile?.previewUrl ? (
                    <img
                      src={uploadedFile.previewUrl}
                      alt="Photo Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center mx-auto">
                        <ImageIcon className="w-6 h-6 text-pink-400" />
                      </div>
                      <div className="text-xs font-semibold text-gray-200">
                        Fotoğraf Gönderisi Önizlemesi
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Yüklediğiniz fotoğraf Instagram akış formatında burada görünür.
                      </p>
                    </div>
                  )}
                </div>

                {/* IG Post Action Bar & Caption Footer */}
                <div className="p-3.5 bg-[#08090d] border-t border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5 text-white">
                      <Heart className="w-5 h-5 hover:text-pink-500 transition" />
                      <MessageCircle className="w-5 h-5" />
                      <Send className="w-4 h-4" />
                    </div>

                    {/* Carousel Dots */}
                    {mediaType === "CAROUSEL" &&
                      previewCarouselUrls.length > 1 && (
                        <div className="flex items-center gap-1">
                          {previewCarouselUrls.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveSwipeIdx(idx)}
                              className={`rounded-full transition-all cursor-pointer ${
                                activeSwipeIdx === idx
                                  ? "w-2 h-2 bg-sky-400"
                                  : "w-1.5 h-1.5 bg-white/30"
                              }`}
                            />
                          ))}
                        </div>
                      )}

                    <Bookmark className="w-5 h-5 text-white" />
                  </div>

                  <div className="text-[11px] font-semibold text-white">
                    1.248 beğenme
                  </div>

                  <div className="text-[11px] text-gray-200 line-clamp-2 leading-snug">
                    <span className="font-bold text-white mr-1.5">
                      {activeAccount?.username || "wawejournal"}
                    </span>
                    {caption || "Gönderi açıklaması ve etiketler burada görünecek..."}
                  </div>
                </div>
              </div>
            ) : mediaType === "STORIES" ? (
              /* =============================================================== */
              /* LAYOUT 2: INSTAGRAM STORIES (Full-screen 9:16 + Story Bar)      */
              /* =============================================================== */
              <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
                {/* Background Media */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#16192b] via-[#0d101b] to-[#07080d] flex items-center justify-center">
                  {uploadedFile?.previewUrl ? (
                    uploadedFile.originalName.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                      <img
                        src={uploadedFile.previewUrl}
                        alt="Story Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={uploadedFile.previewUrl}
                        controls
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center mx-auto shadow-lg shadow-pink-500/10">
                        <Sparkles className="w-7 h-7 text-pink-400" />
                      </div>
                      <div className="text-xs font-bold text-white">
                        Instagram Hikaye (Story) Önizlemesi
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-[210px] mx-auto">
                        9:16 dikey video veya fotoğraf seçtiğinizde tam ekran hikaye önizlemesi burada oynatılır.
                      </p>
                    </div>
                  )}
                </div>

                {/* Story Top Progress & User Header */}
                <div className="relative z-20 px-3.5 pt-2 space-y-2.5 bg-gradient-to-b from-black/75 via-black/30 to-transparent pb-4 pointer-events-none">
                  {/* Story Progress Bars */}
                  <div className="grid grid-cols-3 gap-1">
                    <div className="h-[2.5px] rounded-full bg-white" />
                    <div className="h-[2.5px] rounded-full bg-white/35" />
                    <div className="h-[2.5px] rounded-full bg-white/35" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeAccount?.avatar_url ? (
                        <img
                          src={activeAccount.avatar_url}
                          alt={activeAccount.username}
                          className="w-7 h-7 rounded-full object-cover border border-white/40"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600" />
                      )}
                      <span className="text-xs font-bold text-white drop-shadow">
                        {activeAccount?.username || "wawejournal"}
                      </span>
                      <span className="text-[10px] text-white/70">Şimdi</span>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-white/80" />
                  </div>
                </div>

                {/* Story Bottom Reply Bar */}
                <div className="relative z-20 px-3.5 pb-3 pt-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center gap-2.5 pointer-events-none">
                  <div className="flex-1 px-3.5 py-2 rounded-full border border-white/30 bg-black/40 backdrop-blur-md text-[11px] text-white/80">
                    Mesaj gönder...
                  </div>
                  <Heart className="w-5 h-5 text-white" />
                  <Send className="w-5 h-5 text-white" />
                </div>
              </div>
            ) : (
              /* =============================================================== */
              /* LAYOUT 3: INSTAGRAM REELS / VIDEO (Authentic Reels Overlay)     */
              /* =============================================================== */
              <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
                {/* Video Canvas */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#151829] via-[#0c0f1a] to-[#05060a] flex items-center justify-center">
                  {uploadedFile?.previewUrl ? (
                    <video
                      ref={videoRef}
                      src={uploadedFile.previewUrl}
                      controls
                      loop
                      muted
                      playsInline
                      onLoadedMetadata={(e) => {
                        const dur = e.currentTarget.duration;
                        if (dur && !isNaN(dur) && isFinite(dur)) {
                          setVideoDuration(dur);
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-amber-500/20 border border-pink-500/30 flex items-center justify-center mx-auto shadow-lg shadow-pink-500/10">
                        <Film className="w-7 h-7 text-pink-400" />
                      </div>
                      <div className="text-xs font-bold text-white">
                        Instagram Reels Stüdyo Önizlemesi
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed max-w-[210px] mx-auto">
                        Sol taraftan bir video seçtiğinizde canlı Reels akışı ve kapak karesi burada görünür.
                      </p>
                    </div>
                  )}
                </div>

                {/* Reels Top Header */}
                <div className="relative z-20 px-4 pt-2 pb-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
                  <span className="text-sm font-extrabold tracking-tight text-white drop-shadow">
                    Reels
                  </span>
                  <div className="flex items-center gap-2">
                    {thumbOffsetSec > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-600/80 text-white font-semibold">
                        Kapak: {thumbOffsetSec.toFixed(1)}s
                      </span>
                    )}
                    <Camera className="w-4 h-4 text-white drop-shadow" />
                  </div>
                </div>

                {/* Reels Right Action Column + Bottom Profile & Audio Bar */}
                <div className="relative z-20 px-3.5 pb-4 pt-8 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                  {/* Left: User + Caption + Audio */}
                  <div className="space-y-2 min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0">
                        {activeAccount?.avatar_url ? (
                          <img
                            src={activeAccount.avatar_url}
                            alt={activeAccount.username}
                            className="w-7 h-7 rounded-full object-cover border border-black"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#181b28] flex items-center justify-center text-[10px] font-bold text-white">
                            {(activeAccount?.username || "W")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-white truncate drop-shadow">
                        {activeAccount?.username || "wawejournal"}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/40 text-white backdrop-blur-sm">
                        Takip Et
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-100 line-clamp-2 whitespace-pre-wrap leading-snug drop-shadow">
                      {caption || "Gönderi açıklaması ve etiketler burada görünecek..."}
                    </p>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] text-white/90 max-w-full">
                      <Music2 className="w-3 h-3 text-pink-400 shrink-0" />
                      <span className="truncate">
                        {activeAccount?.username || "wawejournal"} • Orijinal Ses
                      </span>
                    </div>
                  </div>

                  {/* Right: Reels Action Icons */}
                  <div className="flex flex-col items-center gap-3.5 text-white shrink-0 pb-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <Heart className="w-5 h-5 drop-shadow" />
                      <span className="text-[9px] font-semibold">4,2B</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <MessageCircle className="w-5 h-5 drop-shadow" />
                      <span className="text-[9px] font-semibold">128</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <Send className="w-5 h-5 drop-shadow" />
                      <span className="text-[9px] font-semibold">Paylaş</span>
                    </div>
                    <Bookmark className="w-5 h-5 drop-shadow" />
                    <div className="w-6 h-6 rounded-md border-2 border-white/80 overflow-hidden bg-gradient-to-tr from-pink-500 to-purple-600">
                      {activeAccount?.avatar_url && (
                        <img
                          src={activeAccount.avatar_url}
                          alt="Audio"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Home Indicator Bar */}
            <div className="bg-black py-2 flex justify-center z-30">
              <div className="w-28 h-1 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

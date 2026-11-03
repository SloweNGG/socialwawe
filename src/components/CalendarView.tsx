"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Send,
} from "lucide-react";

export interface CalendarPost {
  id: string;
  account_id: string;
  account_username?: string;
  media_type: "REELS" | "VIDEO" | "STORIES";
  video_original_name: string;
  caption: string;
  scheduled_at: string;
  delete_after_publish: number;
  file_deleted: number;
  status: "scheduled" | "processing" | "published" | "failed";
}

interface Props {
  posts: CalendarPost[];
  onReschedule: (postId: string, newIsoDate: string) => Promise<void>;
  onPublishNow: (postId: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
}

export default function CalendarView({
  posts,
  onReschedule,
  onPublishNow,
  onDelete,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleDropOnDay = async (dayNumber: number) => {
    if (!draggedPostId) return;
    const post = posts.find((p) => p.id === draggedPostId);
    setDraggedPostId(null);
    if (!post) return;

    const oldDate = new Date(post.scheduled_at);
    const updatedDate = new Date(
      year,
      month,
      dayNumber,
      oldDate.getHours(),
      oldDate.getMinutes(),
      0
    );
    await onReschedule(post.id, updatedDate.toISOString());
  };

  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#121521] p-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-pink-400" />
            İnteraktif İçerik Takvimi (Sürükle & Bırak)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Planlanan videoları fareyle tutup başka bir güne sürükleyerek paylaşım gününü anında değiştirebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl bg-[#0b0d14] border border-white/10 hover:border-pink-500/40 text-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white min-w-[140px] text-center capitalize">
            {currentMonth.toLocaleDateString("tr-TR", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl bg-[#0b0d14] border border-white/10 hover:border-pink-500/40 text-gray-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-white/10 bg-[#121521] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10 bg-[#0b0d14]">
          {dayNames.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-xs font-semibold text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(125px,auto)] divide-x divide-y divide-white/10">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty_${idx}`} className="bg-[#090a0f]/50 p-2" />;
            }

            const dayPosts = posts.filter((p) => {
              const d = new Date(p.scheduled_at);
              return (
                d.getFullYear() === year &&
                d.getMonth() === month &&
                d.getDate() === day
              );
            });

            const today = new Date();
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;

            return (
              <div
                key={day}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnDay(day)}
                className={`p-2 transition ${
                  isToday ? "bg-pink-500/5" : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? "bg-pink-600 text-white"
                        : "text-gray-400"
                    }`}
                  >
                    {day}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {dayPosts.length} video
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayPosts.map((post) => {
                    const timeStr = new Date(post.scheduled_at).toLocaleTimeString(
                      "tr-TR",
                      { hour: "2-digit", minute: "2-digit" }
                    );

                    const badgeColor =
                      post.status === "published"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : post.status === "failed"
                        ? "bg-red-500/15 border-red-500/30 text-red-300"
                        : "bg-purple-500/15 border-purple-500/30 text-purple-200 hover:border-pink-500/50";

                    return (
                      <div
                        key={post.id}
                        draggable={post.status === "scheduled"}
                        onDragStart={() => setDraggedPostId(post.id)}
                        onClick={() => setSelectedPost(post)}
                        className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition ${badgeColor}`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>{timeStr}</span>
                          <span className="text-[9px] uppercase opacity-75">
                            {post.media_type}
                          </span>
                        </div>
                        <div className="truncate text-[10px] opacity-90 mt-0.5">
                          {post.video_original_name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Post Quick Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121521] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/15 text-pink-300">
                @{selectedPost.account_username || "instagram"} •{" "}
                {selectedPost.media_type}
              </span>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Kapat ✕
              </button>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">
                {selectedPost.video_original_name}
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Planlanan Zaman:{" "}
                <strong className="text-gray-200">
                  {new Date(selectedPost.scheduled_at).toLocaleString("tr-TR")}
                </strong>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0b0d14] border border-white/10 text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {selectedPost.caption || "(Açıklama yok)"}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                Durum:{" "}
                {selectedPost.status === "published" ? (
                  <strong className="text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Yayınlandı
                  </strong>
                ) : selectedPost.status === "failed" ? (
                  <strong className="text-red-400 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Hata
                  </strong>
                ) : (
                  <strong className="text-amber-300 inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Sırada Bekliyor
                  </strong>
                )}
              </span>

              <span>
                {selectedPost.file_deleted
                  ? "🗑️ Dosya otomatik silindi"
                  : selectedPost.delete_after_publish
                  ? "⚡ Yayınlanınca silinecek"
                  : "💾 Arşivde tutulacak"}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={async () => {
                  await onDelete(selectedPost.id);
                  setSelectedPost(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sil
              </button>

              {selectedPost.status !== "published" && (
                <button
                  onClick={async () => {
                    const id = selectedPost.id;
                    setSelectedPost(null);
                    await onPublishNow(id);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  Şimdi Instagram&apos;da Yayınla
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


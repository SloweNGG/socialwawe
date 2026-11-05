"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Copy,
} from "lucide-react";

export interface CaptionTemplateItem {
  id: string;
  folder: string;
  title: string;
  content: string;
}

interface Props {
  onSelectTemplate: (content: string) => void;
  currentCaption?: string;
}

export default function CaptionTemplatesPicker({
  onSelectTemplate,
  currentCaption = "",
}: Props) {
  const [templates, setTemplates] = useState<CaptionTemplateItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("ALL");
  const [showManager, setShowManager] = useState<boolean>(false);

  // Add / Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Unique folders list
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.folder) set.add(t.folder);
    }
    return Array.from(set);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (activeFolder === "ALL") return templates;
    return templates.filter((t) => t.folder === activeFolder);
  }, [templates, activeFolder]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const targetFolder = folderName.trim() || "Genel";

    try {
      if (editingId) {
        await fetch("/api/templates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            folder: targetFolder,
            title,
            content,
          }),
        });
      } else {
        await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder: targetFolder,
            title,
            content,
          }),
        });
      }

      setEditingId(null);
      setTitle("");
      setContent("");
      setActiveFolder(targetFolder);
      await fetchTemplates();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (editingId === id) {
      setEditingId(null);
      setTitle("");
      setContent("");
    }
    await fetchTemplates();
  };

  const handleDeleteFolder = async (folder: string) => {
    await fetch(`/api/templates?folder=${encodeURIComponent(folder)}`, {
      method: "DELETE",
    });
    if (activeFolder === folder) {
      setActiveFolder("ALL");
    }
    await fetchTemplates();
  };

  const startEdit = (t: CaptionTemplateItem) => {
    setEditingId(t.id);
    setFolderName(t.folder);
    setTitle(t.title);
    setContent(t.content);
    setShowManager(true);
  };

  return (
    <div className="space-y-2.5 mt-3 pt-2.5 border-t border-white/[0.07]">
      {/* Top Row: Folder Pills + Manager Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-400 flex items-center gap-1 mr-1 font-medium">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            Açıklama Şablonları:
          </span>

          {folders.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFolder("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition inline-flex items-center gap-1 cursor-pointer ${
                activeFolder === "ALL"
                  ? "bg-purple-600/25 border-purple-500/50 text-purple-200"
                  : "bg-[#0b0d14] border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              <Folder className="w-3 h-3 text-purple-400" />
              <span>Tümü ({templates.length})</span>
            </button>
          )}

          {folders.map((f) => {
            const count = templates.filter((t) => t.folder === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFolder(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer ${
                  activeFolder === f
                    ? "bg-purple-600/25 border-purple-500/50 text-purple-200"
                    : "bg-[#0b0d14] border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <Folder className="w-3 h-3 text-purple-400" />
                <span>{f}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setShowManager((prev) => !prev);
            setEditingId(null);
            if (!folderName && activeFolder !== "ALL") {
              setFolderName(activeFolder);
            }
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 transition cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          {showManager ? "Şablon Yönetimi Kapat" : "+ Şablon / Klasör Ekle"}
        </button>
      </div>

      {/* Quick Select Template Buttons inside Active Folder */}
      {filteredTemplates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filteredTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTemplate(t.content)}
              title={t.content}
              className="px-3 py-1.5 rounded-xl bg-[#0b0d14] border border-white/10 hover:border-purple-500/50 text-xs text-gray-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              {activeFolder === "ALL" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-medium">
                  {t.folder}
                </span>
              )}
              <span className="font-medium">{t.title}</span>
              <span className="text-[10px] text-purple-400 font-bold">+ Ekle</span>
            </button>
          ))}
        </div>
      )}

      {/* Expandable Folder & Template Manager Panel */}
      {showManager && (
        <div className="p-4 rounded-2xl bg-[#0b0d14] border border-purple-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-purple-400" />
              {editingId
                ? "Açıklama Şablonunu Düzenle"
                : "Yeni Klasör ve Açıklama Şablonu Ekle"}
            </h4>

            <div className="flex items-center gap-2">
              {currentCaption.trim() && (
                <button
                  type="button"
                  onClick={() => setContent(currentCaption.trim())}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-purple-200 font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Yukarıdaki Açıklamayı Şablona Kopyala
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setTitle("");
                    setContent("");
                  }}
                  className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> İptal
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveTemplate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Klasör Adı (Mevcut bir klasör seçin veya yeni yazın) *
                </label>
                <input
                  type="text"
                  list="template-folder-suggestions"
                  required
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Örn: Haber Kapanış, Reels Alt Metin, Sponsorlu..."
                  className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <datalist id="template-folder-suggestions">
                  {folders.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Şablon Başlığı *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Takip & Kaydet Çağrısı"
                  className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">
                Hazır Açıklama Metni (Çok satırlı yazabilirsiniz) *
              </label>
              <textarea
                rows={3}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Örn: Bu konu hakkında siz ne düşünüyorsunuz? Yorumlarda buluşalım 👇&#10;&#10;Daha fazlası için takip etmeyi unutmayın 👉 @wawejournal"
                className="w-full rounded-xl bg-[#121521] border border-white/10 p-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold cursor-pointer"
              >
                {editingId ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Şablonu Güncelle
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Klasöre Kaydet
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Grouped Folder & Template List */}
          {folders.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-3 max-h-60 overflow-y-auto pr-1">
              {folders.map((folder) => {
                const items = templates.filter((t) => t.folder === folder);
                return (
                  <div
                    key={folder}
                    className="rounded-xl border border-white/10 bg-[#121521] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                        <Folder className="w-3.5 h-3.5" />
                        <span>{folder}</span>
                        <span className="text-[10px] text-gray-500">
                          ({items.length} şablon)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder)}
                        className="text-[10px] text-gray-500 hover:text-red-400 transition"
                      >
                        Klasörü Sil
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#0b0d14] border border-white/[0.07]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-white truncate">
                              {t.title}
                            </div>
                            <p className="text-[11px] text-gray-400 line-clamp-2 whitespace-pre-wrap mt-0.5">
                              {t.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onSelectTemplate(t.content)}
                              className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[10px] font-semibold cursor-pointer"
                            >
                              + Ekle
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="p-1 text-gray-400 hover:text-white"
                              title="Düzenle"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="p-1 text-gray-400 hover:text-red-400"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


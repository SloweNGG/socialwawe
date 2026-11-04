"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Hash, Plus, Trash2, Edit3, Check, X, FolderPlus } from "lucide-react";

export interface HashtagGroupItem {
  id: string;
  name: string;
  hashtags: string;
}

interface Props {
  onSelectHashtags: (hashtags: string) => void;
}

export default function HashtagGroupsPicker({ onSelectHashtags }: Props) {
  const [groups, setGroups] = useState<HashtagGroupItem[]>([]);
  const [showManager, setShowManager] = useState(false);

  // Add / Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupTags, setGroupTags] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/hashtags");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !groupTags.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await fetch("/api/hashtags", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name: groupName,
            hashtags: groupTags,
          }),
        });
      } else {
        await fetch("/api/hashtags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName,
            hashtags: groupTags,
          }),
        });
      }
      setEditingId(null);
      setGroupName("");
      setGroupTags("");
      await fetchGroups();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    await fetch(`/api/hashtags?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (editingId === id) {
      setEditingId(null);
      setGroupName("");
      setGroupTags("");
    }
    await fetchGroups();
  };

  const startEdit = (g: HashtagGroupItem) => {
    setEditingId(g.id);
    setGroupName(g.name);
    setGroupTags(g.hashtags);
    setShowManager(true);
  };

  return (
    <div className="space-y-2.5 mt-2">
      {/* Quick Group Pills Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-400 flex items-center gap-1 mr-1 font-medium">
            <Hash className="w-3.5 h-3.5 text-pink-400" />
            Etiket Grupları:
          </span>

          {groups.map((g) => {
            const tagCount = g.hashtags.split(/\s+/).filter(Boolean).length;
            return (
              <div
                key={g.id}
                className="inline-flex items-center rounded-xl bg-[#0b0d14] border border-white/10 hover:border-pink-500/40 transition overflow-hidden group"
              >
                <button
                  type="button"
                  onClick={() => onSelectHashtags(g.hashtags)}
                  title={g.hashtags}
                  className="px-2.5 py-1.5 text-xs text-gray-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-500/15 text-pink-300">
                    +{tagCount}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setShowManager((prev) => !prev);
            setEditingId(null);
            setGroupName("");
            setGroupTags("");
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 transition cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          {showManager ? "Yönetimi Kapat" : "+ Grup Ekle / Düzenle"}
        </button>
      </div>

      {/* Expandable Group Manager Panel */}
      {showManager && (
        <div className="p-4 rounded-2xl bg-[#0b0d14] border border-pink-500/25 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-pink-400" />
              {editingId ? "Etiket Grubunu Düzenle" : "Yeni Etiket Grubu Oluştur"}
            </h4>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setGroupName("");
                  setGroupTags("");
                }}
                className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Yeni Ekleme Moduna Dön
              </button>
            )}
          </div>

          <form onSubmit={handleSaveGroup} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-[11px] text-gray-400 mb-1">
                  Grup Adı (Kategori) *
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Örn: 🎬 Sinema & Kesit"
                  className="w-full rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-gray-400 mb-1">
                  Gruptaki Etiketler (Boşlukla ayırın, # koymasanız da otomatik eklenir) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={groupTags}
                    onChange={(e) => setGroupTags(e.target.value)}
                    placeholder="#kesit #film #dizi #reels #keşfet"
                    className="flex-1 rounded-xl bg-[#121521] border border-white/10 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {editingId ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Güncelle
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Grubu Kaydet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Existing Groups List with Edit/Delete */}
          {groups.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="text-[11px] text-gray-400 font-medium">
                Kayıtlı Etiket Gruplarınız ({groups.length}):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#121521] border border-white/10"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-pink-300/80 truncate mt-0.5">
                        {g.hashtags}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectHashtags(g.hashtags)}
                        className="px-2 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 text-[10px] font-semibold"
                        title="Açıklamaya Ekle"
                      >
                        + Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        className="p-1.5 text-gray-400 hover:text-white transition"
                        title="Düzenle"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(g.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition"
                        title="Grubu Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


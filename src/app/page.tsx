"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Film,
  Layers,
  Calendar as CalendarIcon,
  Settings,
  Instagram,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Send,
  RefreshCw,
  LogOut,
  LogIn,
  UserPlus,
  ExternalLink,
  HardDrive,
  Mail,
  Lock,
  User,
  Zap,
  Plus,
  X,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import SingleStudioView from "@/components/SingleStudioView";
import BulkQueueView from "@/components/BulkQueueView";
import CalendarView, { CalendarPost } from "@/components/CalendarView";
import MetaSetupGuide from "@/components/MetaSetupGuide";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  plan: string;
}

interface Account {
  id: string;
  ig_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  is_mock: number;
  followers_count: number;
  token_expires_at: string;
  status: string;
}

interface Post extends CalendarPost {
  video_filename: string;
  video_url: string;
  video_size_bytes: number;
  ig_permalink: string | null;
  error_message: string | null;
  published_at: string | null;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "single" | "bulk" | "calendar" | "accounts"
  >("single");

  const [user, setUser] = useState<UserInfo | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState({
    meta_app_id: "",
    meta_app_secret: "",
    public_base_url: "",
    default_delete_after_publish: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // SaaS Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  const fetchAllData = useCallback(async () => {
    try {
      const [authRes, accRes, postRes, setRes] = await Promise.all([
        fetch("/api/auth"),
        fetch("/api/accounts"),
        fetch("/api/posts"),
        fetch("/api/settings"),
      ]);

      if (authRes.ok) {
        const u = await authRes.json();
        setUser(u.user);
      } else {
        setUser(null);
      }

      if (accRes.ok) {
        const a = await accRes.json();
        setAccounts(a.accounts || []);
      }

      if (postRes.ok) {
        const p = await postRes.json();
        setPosts(p.posts || []);
      }

      if (setRes.ok) {
        const s = await setRes.json();
        if (s.settings) setSettings(s.settings);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    // Auto-poll scheduler every 30 seconds so due videos get published automatically
    const timer = setInterval(() => {
      fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runDue" }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.processedCount > 0) {
            fetchAllData();
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchAllData]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runDue" }),
      });
      await fetchAllData();
    } finally {
      setSyncing(false);
    }
  };

  const handlePublishNow = async (postId: string) => {
    setSyncing(true);
    try {
      await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      await fetchAllData();
    } finally {
      setSyncing(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    await fetch(`/api/posts?id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    });
    await fetchAllData();
  };

  const handleReschedulePost = async (postId: string, newIsoDate: string) => {
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, scheduledAt: newIsoDate }),
    });
    await fetchAllData();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "İşlem başarısız.");
      } else {
        setShowAuthModal(false);
        setAuthName("");
        setAuthEmail("");
        setAuthPassword("");
        await fetchAllData();
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
    setAccounts([]);
    setPosts([]);
  };

  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const cleanedStorageBytes = posts
    .filter((p) => p.file_deleted === 1)
    .reduce((acc, p) => acc + (p.video_size_bytes || 15000000), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070910] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-600/20 animate-pulse">
            <Instagram className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-medium text-gray-400">
            SocialWawe yükleniyor...
          </span>
        </div>
      </div>
    );
  }

  // Full-Screen Login / Register Gate when unauthenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070910] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121521]/95 backdrop-blur-xl p-7 shadow-2xl space-y-6 relative z-10">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-600/25">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                SocialWawe
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Instagram Reels, Carousel Bölücü & Otomatik Zamanlama Stüdyosu
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 rounded-xl bg-[#0b0d14] p-1 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === "login"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
              className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === "register"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Kayıt Ol
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Ad Soyad
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    className="w-full rounded-xl bg-[#0b0d14] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition cursor-pointer"
            >
              {authMode === "register" ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  {authSubmitting ? "Hesap Oluşturuluyor..." : "Hesap Oluştur ve Başla"}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {authSubmitting ? "Giriş Yapılıyor..." : "Stüdyoya Giriş Yap"}
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-white/10 flex items-center justify-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Resmi Meta Graph API
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              7/24 Bulut Zamanlayıcı
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0d101a] border-b md:border-b-0 md:border-r border-white/10 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-amber-500 flex items-center justify-center shadow-lg shadow-pink-600/20">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white">
                  SocialWawe
                </span>
                <span className="block text-[10px] text-pink-400 font-medium">
                  Auto-Reels & SaaS Engine
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-pink-400" />
              Kontrol Paneli & Kuyruk
            </button>

            <button
              onClick={() => setActiveTab("single")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "single"
                  ? "bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3">
                <Film className="w-4 h-4 text-purple-400" />
                Paylaşım & Carousel Stüdyosu
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">
                Tümü
              </span>
            </button>

            <button
              onClick={() => setActiveTab("bulk")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "bulk"
                  ? "bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-amber-400" />
                Toplu Video & Sırala
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300">
                Oto
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              İçerik Takvimi
            </button>

            <button
              onClick={() => setActiveTab("accounts")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "accounts"
                  ? "bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white border border-pink-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4 text-sky-400" />
              Hesaplar & Meta API
            </button>
          </nav>
        </div>

        {/* Bottom User Card (Multi-tenant SaaS Ready) */}
        <div className="pt-6 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Zamanlayıcı Motoru Aktif
          </div>

          <div className="p-3 rounded-xl bg-[#121521] border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-gray-400 truncate">
                  {user.email}
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-pink-500/20 text-pink-300">
                {user.plan}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => {
                  setAuthMode("register");
                  setShowAuthModal(true);
                }}
                className="text-[11px] py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3 h-3" /> Yeni Üye
              </button>
              <button
                onClick={handleLogout}
                className="text-[11px] py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3 h-3" /> Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6">
        {/* Top Action Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h1 className="text-xl font-bold text-white">
              {activeTab === "dashboard" && "Kontrol Paneli & Yayın Kuyruğu"}
              {activeTab === "single" &&
                "Paylaşım & Carousel Stüdyosu (Reels • Carousel Bölücü • Fotoğraf • Hikaye)"}
              {activeTab === "bulk" &&
                "Toplu Video Yükleme & Otomatik Sıraya Dizme"}
              {activeTab === "calendar" && "Sürükle-Bırak İçerik Takvimi"}
              {activeTab === "accounts" &&
                "Instagram Hesapları & Meta API Kurulumu"}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Videolarınızı yükleyin, gün ve saatini seçin; zamanı geldiğinde sistem otomatik Instagram&apos;a atsın.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#121521] border border-white/10 hover:border-pink-500/40 text-xs font-medium text-gray-200 transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-pink-400" : ""}`}
              />
              {syncing ? "İşleniyor..." : "Kuyruğu Şimdi Kontrol Et"}
            </button>

            <button
              onClick={() => setActiveTab("bulk")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-xs font-semibold text-white shadow-lg shadow-pink-600/20 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              Toplu Video Sırala
            </button>
          </div>
        </header>

        {/* Views */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">
            Platform yükleniyor...
          </div>
        ) : activeTab === "dashboard" ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-white/10 bg-[#121521] p-5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Sırada Bekleyen Video</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-white mt-2">
                  {scheduledCount}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Otomatik yayınlanmak üzere hazır
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121521] p-5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Yayınlanan Videolar</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white mt-2">
                  {publishedCount}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Instagram Graph API ile paylaşıldı
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121521] p-5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Otomatik Silinen Depolama</span>
                  <HardDrive className="w-4 h-4 text-pink-400" />
                </div>
                <div className="text-2xl font-extrabold text-white mt-2">
                  {(cleanedStorageBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">
                  Yayın sonrası otomatik temizlendi
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121521] p-5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Bağlı Instagram Hesabı</span>
                  <Instagram className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-extrabold text-white mt-2">
                  {accounts.length}
                </div>
                <button
                  onClick={() => setActiveTab("accounts")}
                  className="text-[11px] text-pink-400 hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Yeni hesap bağla veya yönet
                </button>
              </div>
            </div>

            {/* Queue Table */}
            <div className="rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Zamanlanmış ve Yayınlanmış Gönderiler ({posts.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("single")}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yeni Gönderi Ekle
                  </button>
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Henüz planlanmış bir gönderi yok. Hemen tekli veya toplu içerik yükleyerek başlayın!
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#0b0d14] border border-white/10"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-pink-400">
                            @{post.account_username || "instagram"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-semibold">
                            {post.media_type}
                          </span>
                          <span className="text-xs font-semibold text-white truncate">
                            {post.video_original_name}
                          </span>

                          {post.status === "published" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Yayınlandı
                            </span>
                          ) : post.status === "failed" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-medium">
                              <XCircle className="w-3 h-3" /> Hata: {post.error_message}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                              <Clock className="w-3 h-3" /> Sırada Bekliyor
                            </span>
                          )}

                          {post.file_deleted === 1 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                              <Trash2 className="w-3 h-3" /> Dosya Sunucudan Silindi
                            </span>
                          ) : post.delete_after_publish === 1 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                              <Zap className="w-3 h-3 text-amber-400" /> Yayınlanınca Silinecek
                            </span>
                          ) : null}
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-1">
                          {post.caption || "(Açıklama yok)"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">
                            {new Date(post.scheduled_at).toLocaleDateString(
                              "tr-TR",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </div>
                          <div className="text-[11px] text-purple-300">
                            Saat{" "}
                            {new Date(post.scheduled_at).toLocaleTimeString(
                              "tr-TR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>

                        {post.status === "published" && post.ig_permalink && (
                          <a
                            href={post.ig_permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-pink-400"
                            title="Instagram'da Gör"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {post.status !== "published" && (
                          <button
                            onClick={() => handlePublishNow(post.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-pink-200 text-xs font-semibold cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Şimdi Yayınla
                          </button>
                        )}

                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "single" ? (
          <SingleStudioView
            accounts={accounts}
            onScheduled={() => {
              fetchAllData();
            }}
          />
        ) : activeTab === "bulk" ? (
          <BulkQueueView
            accounts={accounts}
            onScheduled={() => {
              fetchAllData();
              setActiveTab("calendar");
            }}
          />
        ) : activeTab === "calendar" ? (
          <CalendarView
            posts={posts}
            onReschedule={handleReschedulePost}
            onPublishNow={handlePublishNow}
            onDelete={handleDeletePost}
          />
        ) : (
          <MetaSetupGuide
            accounts={accounts}
            settings={settings}
            onRefresh={fetchAllData}
          />
        )}
      </main>

      {/* Multi-User SaaS Login / Register Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121521] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {authMode === "register"
                  ? "Yeni SaaS Kullanıcı Hesabı Oluştur"
                  : "Kullanıcı Girişi Yap"}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex rounded-xl bg-[#0b0d14] p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${
                  authMode === "register"
                    ? "bg-pink-600 text-white"
                    : "text-gray-400"
                }`}
              >
                Kayıt Ol (Yeni Üye)
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${
                  authMode === "login"
                    ? "bg-pink-600 text-white"
                    : "text-gray-400"
                }`}
              >
                Giriş Yap
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "register" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2 text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Şifre
                </label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2 text-sm text-white"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-red-500/15 text-red-300 text-xs">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold text-sm"
              >
                {authMode === "register" ? "Hesap Oluştur ve Geçiş Yap" : "Giriş Yap"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


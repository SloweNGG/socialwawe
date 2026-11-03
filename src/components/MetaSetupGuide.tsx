"use client";

import React, { useState } from "react";
import {
  Instagram,
  Plus,
  Trash2,
  CheckCircle2,
  BookOpen,
  KeyRound,
  Globe,
  Sparkles,
  ExternalLink,
} from "lucide-react";

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

interface AppSettings {
  meta_app_id: string;
  meta_app_secret: string;
  public_base_url: string;
  default_delete_after_publish: number;
}

interface Props {
  accounts: Account[];
  settings: AppSettings;
  onRefresh: () => void;
}

export default function MetaSetupGuide({
  accounts,
  settings,
  onRefresh,
}: Props) {
  const [connectMode, setConnectMode] = useState<"real" | "mock">("real");
  const [username, setUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [publicUrl, setPublicUrl] = useState(settings.public_base_url || "");
  const [metaAppId, setMetaAppId] = useState(settings.meta_app_id || "");
  const [savingSettings, setSavingSettings] = useState(false);

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: connectMode,
          username,
          igUserId,
          accessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Hesap bağlanamadı.");
      } else {
        setUsername("");
        setIgUserId("");
        setAccessToken("");
        setSuccessMsg("Instagram hesabı başarıyla bağlandı!");
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg(null);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta_app_id: metaAppId,
          public_base_url: publicUrl,
          default_delete_after_publish: 1,
        }),
      });
      setSuccessMsg("API ve Sunucu URL ayarları kaydedildi.");
      onRefresh();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    await fetch(`/api/accounts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Connected Accounts List */}
      <div className="rounded-2xl border border-white/10 bg-[#121521] p-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Instagram className="w-5 h-5 text-pink-400" />
          Bağlı Instagram Hesapları ({accounts.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[#0b0d14] border border-white/10"
            >
              <div className="flex items-center gap-3">
                <img
                  src={acc.avatar_url}
                  alt={acc.username}
                  className="w-11 h-11 rounded-full bg-pink-500/20 border border-pink-500/30 object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      @{acc.username}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        acc.is_mock
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {acc.is_mock ? "Simülasyon / Test" : "Resmi Graph API"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    IG ID: {acc.ig_user_id} •{" "}
                    {acc.followers_count.toLocaleString("tr-TR")} takipçi
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRemoveAccount(acc.id)}
                className="p-2 text-gray-500 hover:text-red-400 transition"
                title="Hesabı Kaldır"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Account & Step-by-Step Meta Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connect New Account Form */}
        <div className="rounded-2xl border border-white/10 bg-[#121521] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-pink-400" />
              Yeni Instagram Hesabı Bağla
            </h3>

            <div className="flex rounded-lg bg-[#0b0d14] p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setConnectMode("real")}
                className={`px-3 py-1 rounded-md transition ${
                  connectMode === "real"
                    ? "bg-pink-600 text-white font-semibold"
                    : "text-gray-400"
                }`}
              >
                Gerçek Meta API
              </button>
              <button
                type="button"
                onClick={() => setConnectMode("mock")}
                className={`px-3 py-1 rounded-md transition ${
                  connectMode === "mock"
                    ? "bg-purple-600 text-white font-semibold"
                    : "text-gray-400"
                }`}
              >
                Test Hesabı Ekle
              </button>
            </div>
          </div>

          <form onSubmit={handleConnectAccount} className="space-y-4">
            {connectMode === "real" ? (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Instagram Access Token (Uzun Ömürlü Token) *
                  </label>
                  <input
                    type="password"
                    required
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="IGQWR... veya EAAB..."
                    className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Token girdiğinizde kullanıcı adı ve IG ID otomatik çekilir.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Instagram User ID (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      value={igUserId}
                      onChange={(e) => setIgUserId(e.target.value)}
                      placeholder="178414..."
                      className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Kullanıcı Adı (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@hesabiniz"
                      className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Simülasyon Hesabı Kullanıcı Adı *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="orn: mizahsayfam.tr"
                  className="w-full rounded-xl bg-[#0b0d14] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Meta Developer hesabınızı açana kadar tüm video yükleme, sıraya dizme ve yayınlanınca silme sistemini bu test hesabıyla birebir deneyebilirsiniz.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-sm transition cursor-pointer"
            >
              {loading
                ? "Bağlanıyor..."
                : connectMode === "real"
                ? "Instagram Graph API ile Bağla"
                : "Test Hesabını Ekle"}
            </button>
          </form>

          {/* Public URL Setting for Real API */}
          <form
            onSubmit={handleSaveSettings}
            className="pt-4 border-t border-white/10 space-y-3"
          >
            <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-pink-400" />
              Canlı Sunucu / Tünel Adresi (Gerçek API İçin)
            </h4>
            <p className="text-[11px] text-gray-400">
              Instagram sunucularının yüklediğiniz videoyu çekebilmesi için uygulamanızın internete açık adresi (örn. canlı domaininiz veya yerel testte <code>https://xyz.ngrok-free.app</code>):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="https://ornekdomain.com veya https://xyz.ngrok-free.app"
                className="flex-1 rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>

        {/* Step-by-Step Interactive Meta Developer Guide */}
        <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-b from-[#121521] to-[#0d101a] p-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/15 text-pink-300 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />5 Dakikada Resmi Instagram API Kurulum Rehberi
          </div>

          <h3 className="text-base font-bold text-white">
            Meta Developer Hesabı Nasıl Açılır ve Bağlanır?
          </h3>

          <ol className="space-y-3 text-xs text-gray-300">
            <li className="p-3 rounded-xl bg-[#0b0d14] border border-white/10">
              <strong className="text-white block mb-0.5">
                1. Instagram Hesabınızı Profesyonel Hesaba Geçirin
              </strong>
              Instagram uygulamasında{" "}
              <em>Ayarlar → Hesap Türü ve Araçları → Profesyonel Hesaba Geçiş Yap</em>{" "}
              adımından <strong>İçerik Üretici (Creator)</strong> veya{" "}
              <strong>İşletme (Business)</strong> seçin (Ücretsizdir).
            </li>

            <li className="p-3 rounded-xl bg-[#0b0d14] border border-white/10">
              <strong className="text-white block mb-0.5">
                2. Meta for Developers&apos;da Uygulama Oluşturun
              </strong>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-pink-400 hover:underline inline-flex items-center gap-1"
              >
                developers.facebook.com/apps <ExternalLink className="w-3 h-3" />
              </a>{" "}
              adresine gidin, <strong>Create App → Other → Business</strong>{" "}
              seçerek bir uygulama oluşturun.
            </li>

            <li className="p-3 rounded-xl bg-[#0b0d14] border border-white/10">
              <strong className="text-white block mb-0.5">
                3. Instagram Ürününü ve İzinleri Ekleyin
              </strong>
              Sol menüden <strong>Add Product → Instagram</strong> seçin.{" "}
              <em>API Setup with Instagram Login</em> altında hesabınızı{" "}
              <strong>Instagram Tester</strong> olarak ekleyin ve{" "}
              <code>instagram_business_basic</code>,{" "}
              <code>instagram_business_content_publish</code> izinlerini aktif edin.
            </li>

            <li className="p-3 rounded-xl bg-[#0b0d14] border border-white/10">
              <strong className="text-white block mb-0.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-pink-400" />
                4. Token Üretip Sol Taraftaki Kutuya Yapıştırın
              </strong>
              Aynı ekrandaki <strong>Generate Token</strong> butonuna tıklayıp Instagram hesabınızla onay verin. Çıkan{" "}
              <code>IG...</code> ile başlayan token&apos;ı sol taraftaki{" "}
              <strong>Instagram Access Token</strong> alanına yapıştırın!
            </li>
          </ol>

          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>İpucu:</strong> Kendi hesaplarınız için Meta&apos;da{" "}
              <em>App Review (Uygulama İncelemesi)</em> beklemenize gerek yoktur! Hesabınızı &quot;Tester&quot; olarak ekleyip anında otomatik Reels yüklemeye başlayabilirsiniz.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


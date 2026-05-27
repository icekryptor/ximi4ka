"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { BindEmailBanner } from "@/components/profile/BindEmailBanner";
import { getRankState } from "@/lib/ranks";
import { RankCard } from "@/components/profile/RankCard";
import { AchievementsCard } from "@/components/profile/AchievementsCard";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [kitModule, setKitModule] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isKitEmail, setIsKitEmail] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [userAchievements, setUserAchievements] = useState<any[]>([]);
  const [totalAchCount, setTotalAchCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setIsKitEmail(user.email?.endsWith("@kits.ximi4ka.ru") ?? false);

      const nowIso = new Date().toISOString();
      const [{ data: p }, { data: s }, { data: km }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").gt("expires_at", nowIso).maybeSingle(),
        supabase
          .from("user_modules")
          .select("expires_at, source, modules(slug, title)")
          .eq("user_id", user.id)
          .gt("expires_at", nowIso)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setProfile(p);
      setSubscription(s);
      setKitModule(km);
      setDisplayName(p?.display_name || "");
      setTelegram(p?.telegram || "");
      setAvatarUrl(p?.avatar_url || "");

      const [{ data: attempts }, { data: ua }, { count: totalAch }] = await Promise.all([
        supabase.from("task_attempts").select("points_earned").eq("user_id", user.id),
        supabase
          .from("user_achievements")
          .select("id, earned_at, achievements(title, description, icon_url)")
          .eq("user_id", user.id)
          .order("earned_at", { ascending: false }),
        supabase.from("achievements").select("*", { count: "exact", head: true }),
      ]);
      const xp = (attempts ?? []).reduce((s: number, a: any) => s + (a.points_earned ?? 0), 0);
      setTotalXp(xp);
      setUserAchievements(ua ?? []);
      setTotalAchCount(totalAch ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarUpload(file: File) {
    setUploadError("");
    if (!profile?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Файл больше 5 МБ — выбери поменьше");
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setUploadError("Только JPG, PNG, WEBP или GIF");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) {
        setUploadError(upErr.message);
        setUploadingAvatar(false);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      setAvatarUrl(url);
      // Persist to profiles immediately so header updates
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      router.refresh();
    } catch (e: any) {
      setUploadError(e?.message || "Не удалось загрузить");
    }
    setUploadingAvatar(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        telegram: telegram.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", profile.id);
    router.refresh();
    setSaving(false);
  }

  async function handleActivatePromo() {
    const res = await fetch("/api/promo/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setPromoMessage("Промокод активирован! Подписка base_promo на 1 месяц бесплатно.");
      setPromoCode("");
      // Reload subscription
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: s } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").single();
        setSubscription(s);
      }
    } else {
      setPromoMessage(data.error || "Ошибка активации");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Skeleton mirrors the real layout so the page doesn't jump on load */}
      <div className="h-8 w-32 rounded-lg bg-white/[0.06] animate-pulse mb-6" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="h-32 rounded-2xl bg-white/[0.04] animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/[0.04] animate-pulse" />
      </div>
      <div className="h-64 rounded-2xl bg-white/[0.04] animate-pulse mb-6" />
      <div className="h-40 rounded-2xl bg-white/[0.04] animate-pulse mb-6" />
      <div className="h-32 rounded-2xl bg-white/[0.04] animate-pulse" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-dark-text">Профиль</h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <RankCard totalXp={totalXp} state={getRankState(totalXp)} />
        <AchievementsCard earned={userAchievements} totalAvailable={totalAchCount} />
      </div>

      {isKitEmail && <BindEmailBanner />}

      <Card theme="dark" className="p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 text-dark-text">Личные данные</h2>
        <div className="space-y-4">
          <Input
            theme="dark"
            id="name"
            label="Имя"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Иван Петров"
          />
          <Input
            theme="dark"
            id="telegram"
            label="Telegram"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username"
          />
          <div>
            <label className="block mb-2 text-sm font-medium text-dark-text-secondary">
              Аватар
            </label>
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Аватар"
                  className="w-20 h-20 rounded-full object-cover border border-white/10 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-gradient-start to-primary-gradient-end flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {(displayName || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <label className="inline-flex items-center justify-center text-sm font-semibold text-dark-text px-4 py-2 rounded-full bg-white/10 border border-white/10 cursor-pointer hover:bg-white/15 transition-colors">
                  {uploadingAvatar ? "Загрузка..." : avatarUrl ? "Заменить" : "Загрузить с устройства"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="ml-3 text-sm text-dark-text-muted hover:text-error-dark transition-colors"
                  >
                    Удалить
                  </button>
                )}
                <p className="mt-2 text-xs text-dark-text-muted">JPG, PNG, WEBP, GIF · до 5 МБ</p>
                {uploadError && (
                  <p className="mt-1 text-xs text-error-dark">{uploadError}</p>
                )}
              </div>
            </div>
          </div>
          <Button theme="dark" onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Card>

      <Card theme="dark" className="p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 text-dark-text">Доступ</h2>
        {subscription ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge theme="dark" variant="xp">Подписка активна</Badge>
              <span className="text-sm text-dark-text-secondary">
                План: {(() => {
                  switch (subscription.plan) {
                    case "base_promo": return "499 ₽/мес (промо, legacy)";
                    case "base_yearly": return "2 590 ₽/год";
                    case "base":
                    default: return "299 ₽/мес";
                  }
                })()}
              </span>
            </div>
            <p className="text-sm text-dark-text-muted">
              Действует до: {new Date(subscription.expires_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        ) : kitModule ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge theme="dark" variant="xp">Доступ из набора</Badge>
              <span className="text-sm text-dark-text-secondary">
                {kitModule.modules?.title ?? "Модуль"}
              </span>
            </div>
            <p className="text-sm text-dark-text-muted">
              Действует до: {new Date(kitModule.expires_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-dark-text-muted text-sm mb-4">У тебя нет активной подписки</p>
            <div className="flex items-end gap-3">
              <Input
                theme="dark"
                id="promo"
                label="Активировать промокод"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="XIMI-XXXX-XXXX"
              />
              <Button theme="dark" size="sm" onClick={handleActivatePromo} disabled={!promoCode}>
                Активировать
              </Button>
            </div>
            {promoMessage && (
              <p className={`text-sm mt-2 ${promoMessage.includes("Ошибка") ? "text-error-dark" : "text-success-dark"}`}>
                {promoMessage}
              </p>
            )}
            <Button theme="dark" variant="secondary" className="mt-4 w-full" onClick={() => router.push("/pricing")}>
              Оформить подписку
            </Button>
          </div>
        )}
      </Card>

      <Card theme="dark" className="p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 text-dark-text">Устройства</h2>
        <p className="text-sm text-dark-text-muted mb-4">
          Аккаунт можно использовать одновременно на 3 устройствах. Если хочешь добавить новое, удали одно из старых.
        </p>
        <Button
          theme="dark"
          variant="secondary"
          size="sm"
          onClick={() => router.push("/profile/devices")}
        >
          Управление устройствами
        </Button>
      </Card>

      <Button theme="dark" variant="ghost" onClick={handleLogout} className="text-error-dark hover:text-error">
        Выйти из аккаунта
      </Button>
    </div>
  );
}

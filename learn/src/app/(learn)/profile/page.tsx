"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { BindEmailBanner } from "@/components/profile/BindEmailBanner";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isKitEmail, setIsKitEmail] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setIsKitEmail(user.email?.endsWith("@kits.ximi4ka.ru") ?? false);

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").single(),
      ]);

      setProfile(p);
      setSubscription(s);
      setDisplayName(p?.display_name || "");
      setTelegram(p?.telegram || "");
      setAvatarUrl(p?.avatar_url || "");
      setLoading(false);
    }
    load();
  }, []);

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
      <p className="text-dark-text-muted">Загрузка...</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-dark-text">Профиль</h1>

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
          <Input
            theme="dark"
            id="avatar"
            label="Аватар (URL картинки)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Превью аватара"
              className="w-16 h-16 rounded-full object-cover border border-white/10"
              referrerPolicy="no-referrer"
            />
          )}
          <Button theme="dark" onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Card>

      <Card theme="dark" className="p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 text-dark-text">Подписка</h2>
        {subscription ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge theme="dark" variant="xp">Активна</Badge>
              <span className="text-sm text-dark-text-secondary">
                План: {subscription.plan === "base_promo" ? "499 ₽/мес (промо)" : "999 ₽/мес"}
              </span>
            </div>
            <p className="text-sm text-dark-text-muted">
              Действует до: {new Date(subscription.expires_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-dark-text-muted text-sm mb-4">У вас нет активной подписки</p>
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

      <Button theme="dark" variant="ghost" onClick={handleLogout} className="text-error-dark hover:text-error">
        Выйти из аккаунта
      </Button>
    </div>
  );
}

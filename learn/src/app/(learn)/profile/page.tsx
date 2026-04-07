"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").single(),
      ]);

      setProfile(p);
      setSubscription(s);
      setDisplayName(p?.display_name || "");
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("id", profile.id);
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

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8"><p className="text-text-secondary">Загрузка...</p></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Профиль</h1>

      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">Личные данные</h2>
        <div className="space-y-4">
          <Input id="name" label="Имя" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">Подписка</h2>
        {subscription ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="xp">Активна</Badge>
              <span className="text-sm text-text-secondary">
                План: {subscription.plan === "base_promo" ? "499 ₽/мес (промо)" : "999 ₽/мес"}
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Действует до: {new Date(subscription.expires_at).toLocaleDateString("ru-RU")}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-text-secondary text-sm mb-4">У вас нет активной подписки</p>
            <div className="flex items-end gap-3">
              <Input
                id="promo"
                label="Активировать промокод"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="XIMI-XXXX-XXXX"
              />
              <Button size="sm" onClick={handleActivatePromo} disabled={!promoCode}>
                Активировать
              </Button>
            </div>
            {promoMessage && (
              <p className={`text-sm mt-2 ${promoMessage.includes("Ошибка") ? "text-red-500" : "text-green-600"}`}>
                {promoMessage}
              </p>
            )}
            <Button variant="secondary" className="mt-4 w-full" onClick={() => router.push("/pricing")}>
              Оформить подписку
            </Button>
          </div>
        )}
      </Card>

      <Button variant="ghost" onClick={handleLogout} className="text-red-500 hover:text-red-700">
        Выйти из аккаунта
      </Button>
    </div>
  );
}

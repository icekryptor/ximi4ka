"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (promoCode.trim()) {
      await fetch("/api/promo/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <Card glass>
        <h1 className="text-2xl font-bold text-center mb-4">Проверьте почту</h1>
        <p className="text-text-secondary text-center">
          Мы отправили ссылку для подтверждения на <strong>{email}</strong>
        </p>
      </Card>
    );
  }

  return (
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Регистрация</h1>
      <form onSubmit={handleRegister} className="space-y-4">
        <Input id="displayName" label="Имя" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как вас зовут?" required />
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <Input id="password" label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required />
        <Input id="promoCode" label="Промокод (необязательно)" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="XIMI-XXXX-XXXX" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-text-secondary">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:underline">Войти</Link>
      </div>
    </Card>
  );
}

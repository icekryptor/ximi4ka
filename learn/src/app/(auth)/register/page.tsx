"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

type SuccessKind = "new" | "already_exists";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessKind | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Anti-enumeration quirk: Supabase returns 200 OK for a signup on an
    // already-registered email AND does NOT send a confirmation email — but
    // exposes it client-side via `user.identities = []` (empty array means
    // "no new identity was created"). Without this check, the user sees
    // "check your email" and waits forever for a letter that never arrives —
    // which is exactly the support ticket we keep getting.
    //
    // Caveat: only works while "Confirm email" is enabled at the project level
    // (it is — verified in Supabase Auth settings). If that toggle gets flipped
    // off, identities will be populated and this branch becomes unreachable;
    // user sees the same "new" success screen, harmless.
    const alreadyRegistered =
      !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;

    if (alreadyRegistered) {
      setSuccess("already_exists");
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

    setSuccess("new");
    setLoading(false);
  }

  async function handleSendReset() {
    setResetSending(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Mirror Supabase's anti-enumeration response: always show "sent" even if
    // the email isn't actually registered. Here we know it IS (we just got
    // already_exists from signup), so the letter will arrive.
    setResetSent(true);
    setResetSending(false);
  }

  if (success === "already_exists") {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-3">
          У вас уже есть аккаунт
        </h1>
        <p className="text-text-secondary mb-6">
          Email <strong className="text-text-primary">{email}</strong> уже зарегистрирован.
          Войдите по своему паролю или восстановите доступ.
        </p>

        <div className="space-y-3">
          <Link href={`/login?email=${encodeURIComponent(email)}`} className="block">
            <Button className="w-full" size="lg">Войти</Button>
          </Link>

          {resetSent ? (
            <p className="text-sm text-text-secondary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              Ссылка для сброса пароля отправлена на <strong>{email}</strong>.
              Проверьте почту (включая «Спам»).
            </p>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleSendReset}
              disabled={resetSending}
            >
              {resetSending ? "Отправляем…" : "Забыли пароль?"}
            </Button>
          )}
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Это не вы создавали аккаунт?{" "}
          <a href="mailto:info@ximi4ka.ru" className="text-primary hover:underline">
            Напишите нам
          </a>
        </p>
      </Card>
    );
  }

  if (success === "new") {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">
          Проверьте почту
        </h1>
        <p className="text-text-secondary mb-2">
          Мы отправили ссылку для подтверждения на{" "}
          <strong className="text-text-primary">{email}</strong>
        </p>
        <p className="text-xs text-text-muted mt-4">
          Письмо не пришло за пару минут? Загляните в «Спам» или{" "}
          <a href="mailto:info@ximi4ka.ru" className="text-primary hover:underline">
            напишите нам
          </a>.
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
        Регистрация
      </h1>
      <p className="text-text-muted text-center text-sm mb-8">
        Создайте аккаунт и начните учиться
      </p>
      <form onSubmit={handleRegister} className="space-y-5">
        <Input
          id="displayName"
          label="Имя"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как вас зовут?"
          required
        />
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          id="password"
          label="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Минимум 6 символов"
          minLength={6}
          required
        />
        <Input
          id="promoCode"
          label="Промокод (необязательно)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          placeholder="XIMI-XXXX-XXXX"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:text-primary-hover transition-colors font-medium">
          Войти
        </Link>
      </div>
    </Card>
  );
}

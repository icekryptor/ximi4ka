"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { DeviceLimitModal } from "@/components/auth/DeviceLimitModal";
import { getDeviceId } from "@/lib/device-id";

// Friendly error messages from /kit-login or middleware.
// Keep them kid-friendly + actionable.
const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  kit_invalid: {
    title: "Логин или пароль не подошли",
    body: "Проверь — на карточке буквы заглавные. Попробуй ввести вручную ниже.",
  },
  kit_missing_creds: {
    title: "В QR-коде не хватает данных",
    body: "Открой карточку из набора и попробуй ввести логин и пароль вручную.",
  },
  kit_disabled: {
    title: "Этот код заблокирован",
    body: "Напиши нам в Telegram — поможем за 5 минут.",
  },
  device_limit: {
    title: "Ты заходил с других устройств",
    body: "Введи логин и пароль ещё раз — мы покажем список, выбери какое устройство удалить.",
  },
  device_removed: {
    title: "Это устройство было удалено",
    body: "Войди снова, чтобы добавить его обратно.",
  },
  server: {
    title: "Что-то сломалось на нашей стороне",
    body: "Попробуй ещё раз через минуту. Если повторяется — напиши нам в Telegram.",
  },
  auth: {
    title: "Не удалось подтвердить вход",
    body: "Попробуй войти ещё раз.",
  },
};

function LoginForm() {
  const searchParams = useSearchParams();
  // Prefill from ?email=… — used when /register redirects an
  // already-registered user here. Saves them retyping the address.
  const [login, setLogin] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceModal, setDeviceModal] = useState<{
    devices: any[]; login: string; password: string;
  } | null>(null);
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const initialError = errorParam ? ERROR_MESSAGES[errorParam] : null;
  const cameFromKit = errorParam?.startsWith("kit_") || errorParam === "device_limit" || errorParam === "device_removed";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const deviceId = getDeviceId();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password: password.trim(), device_id: deviceId }),
      });
      const data = await res.json();
      if (res.ok) {
        // router.push triggers a real navigation that SSR-renders the target
        // route freshly — middleware re-reads cookies, dashboard re-fetches.
        // router.refresh() would force an EXTRA round-trip of the current
        // page first, adding ~500ms for nothing. Skip it.
        router.push(data.redirect ?? redirect);
      } else if (res.status === 409) {
        setDeviceModal({ devices: data.devices, login: login.trim(), password: password.trim() });
        setLoading(false);
      } else {
        setError(data.error ?? "Ошибка входа");
        setLoading(false);
      }
    } catch {
      setError("Нет интернета. Проверь Wi-Fi и попробуй ещё раз.");
      setLoading(false);
    }
  }

  return (
    <>
      {deviceModal && (
        <DeviceLimitModal
          devices={deviceModal.devices}
          login={deviceModal.login}
          password={deviceModal.password}
          onClose={() => setDeviceModal(null)}
          onRemoved={() => {
            setDeviceModal(null);
            handleLogin(new Event("submit") as unknown as React.FormEvent);
          }}
        />
      )}

      <Card className="w-full max-w-md p-6 md:p-8">
        {/* Initial error from QR-redirect — show prominently so kids understand */}
        {initialError && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900 text-sm mb-1">{initialError.title}</p>
            <p className="text-amber-800 text-sm leading-relaxed">{initialError.body}</p>
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
          Вход в XimiLearn
        </h1>
        <p className="text-text-muted text-center text-sm mb-6">
          {cameFromKit
            ? "Введи логин и пароль с карточки из коробки"
            : "Введи данные своего аккаунта"}
        </p>

        {/* Friendly help for kit users when QR fails — VERY visible */}
        {cameFromKit && (
          <div className="mb-5 rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-text-secondary leading-relaxed">
            <p className="font-semibold text-primary mb-1">📦 У тебя карточка с QR-кодом</p>
            <p>На ней под надписью «Логин:» — то что вводить в первое поле (начинается с <span className="font-mono">ximi-</span>).<br/>
            Под надписью «Пароль:» — во второе. <b>Большие буквы и цифры</b> — как написано.</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            id="login"
            label="Логин"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value.trim())}
            placeholder="ximi-XXXXXX"
            // Hint browser autofill toward the right field
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <Input
            id="password"
            label="Пароль"
            type="text"  // Plain text — kits passwords are non-secret, helps kids read what they typed
            value={password}
            onChange={(e) => setPassword(e.target.value.trim())}
            placeholder="XXXX-XXXX"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-muted space-y-2">
          <div>
            <Link href="/forgot-password" className="text-primary hover:text-primary-hover transition-colors">
              Забыли пароль?
            </Link>
          </div>
          <div>
            Нет аккаунта?{" "}
            <Link href="/register" className="text-primary hover:text-primary-hover transition-colors font-medium">
              Регистрация
            </Link>
          </div>
          <div className="pt-3 border-t border-border mt-4">
            <p className="text-xs text-text-muted">
              Не получается? Напиши нам:{" "}
              <a href="https://t.me/ximi4ka_support" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Telegram
              </a>
              {" · "}
              <a href="mailto:info@ximi4ka.ru" className="text-primary hover:underline">info@ximi4ka.ru</a>
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-text-muted">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { DeviceLimitModal } from "@/components/auth/DeviceLimitModal";

function LoginForm() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceModal, setDeviceModal] = useState<{
    devices: any[];
    login: string;
    password: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const deviceId = (() => {
      if (typeof window === "undefined") return "";
      let id = localStorage.getItem("xim_device_id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("xim_device_id", id);
      }
      return id;
    })();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, device_id: deviceId }),
      });
      const data = await res.json();

      if (res.ok) {
        router.push(data.redirect ?? redirect);
        router.refresh();
      } else if (res.status === 409) {
        setDeviceModal({ devices: data.devices, login, password });
        setLoading(false);
      } else {
        setError(data.error ?? "Ошибка входа");
        setLoading(false);
      }
    } catch {
      setError("Сетевая ошибка. Попробуйте снова.");
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
            // Re-trigger login now that a device slot is free
            handleLogin(new Event("submit") as unknown as React.FormEvent);
          }}
        />
      )}

      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
          Вход в XimiLearn
        </h1>
        <p className="text-text-muted text-center text-sm mb-8">
          Введите данные вашего аккаунта
        </p>
        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            id="login"
            label="Логин или email"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="ximi-XXXXXX или you@example.com"
            required
          />
          <Input
            id="password"
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            required
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-text-muted space-y-2">
          <div>
            <Link
              href="/forgot-password"
              className="text-primary hover:text-primary-hover transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>
          <div>
            Нет аккаунта?{" "}
            <Link
              href="/register"
              className="text-primary hover:text-primary-hover transition-colors font-medium"
            >
              Регистрация
            </Link>
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

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FlaskConical, AlertCircle } from "lucide-react";
import { getDeviceId } from "@/lib/device-id";

type Status = "idle" | "loading" | "success" | "invalid" | "device_limit" | "error";

function KitLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const login = params.get("l");
    const password = params.get("p");
    if (!login || !password) {
      setStatus("invalid");
      setErrorMsg("В ссылке нет логина или пароля");
      return;
    }

    setStatus("loading");
    const deviceId = getDeviceId();

    (async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password, device_id: deviceId }),
        });
        const data = await res.json();

        if (res.ok) {
          // Replace URL so password doesn't stay in browser history
          window.history.replaceState({}, "", "/dashboard");
          setStatus("success");
          router.push(data.redirect ?? "/dashboard");
          router.refresh();
        } else if (res.status === 409) {
          setStatus("device_limit");
          // Pass-through to /login with creds preserved in state? Simplest:
          // Redirect to /login with a message — user enters creds again, sees device modal there.
          setTimeout(() => router.push("/login?error=device_limit"), 1500);
        } else if (res.status === 401 || res.status === 403) {
          setStatus("invalid");
          setErrorMsg(data?.error ?? "Логин или пароль неверны");
        } else {
          setStatus("error");
          setErrorMsg(data?.error ?? "Ошибка входа");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Не удалось связаться с сервером. Проверь интернет.");
      }
    })();
  }, [params, router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-3xl shadow-soft border border-border p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-5 flex items-center justify-center">
          <FlaskConical className="w-7 h-7 text-primary" />
        </div>

        {(status === "idle" || status === "loading") && (
          <>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
              Заходим в XimiLearn…
            </h1>
            <p className="text-text-secondary text-sm mb-6">
              Подожди пару секунд — открываем доступ к ОГЭ-модулю.
            </p>
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
              Готово!
            </h1>
            <p className="text-text-secondary text-sm">Открываем dashboard…</p>
          </>
        )}

        {status === "device_limit" && (
          <>
            <div className="w-12 h-12 rounded-full bg-error/10 mx-auto mb-3 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">
              Превышен лимит устройств
            </h1>
            <p className="text-text-secondary text-sm mb-4">
              Этот аккаунт уже залогинен на 3-х устройствах. Перенаправляем на форму входа,
              где ты сможешь удалить одно из них.
            </p>
          </>
        )}

        {(status === "invalid" || status === "error") && (
          <>
            <div className="w-12 h-12 rounded-full bg-error/10 mx-auto mb-3 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <h1 className="font-display text-xl font-bold text-text-primary mb-2">
              {status === "invalid" ? "Ссылка не подошла" : "Что-то пошло не так"}
            </h1>
            <p className="text-text-secondary text-sm mb-5">{errorMsg}</p>
            <Link
              href="/login"
              className="inline-block text-sm font-semibold text-white px-5 py-2 rounded-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple transition-shadow"
            >
              Войти вручную
            </Link>
            <p className="mt-4 text-xs text-text-muted">
              Логин и пароль напечатаны на стикере вместе с QR-кодом.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function KitLoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-text-secondary p-10">Загрузка…</div>}>
      <KitLoginInner />
    </Suspense>
  );
}

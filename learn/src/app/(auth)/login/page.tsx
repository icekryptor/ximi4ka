"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
        Вход в XimiLearn
      </h1>
      <p className="text-text-muted text-center text-sm mb-8">
        Введите данные вашего аккаунта
      </p>
      <form onSubmit={handleLogin} className="space-y-5">
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
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-text-muted">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}

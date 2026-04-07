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
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Вход в XimiLearn</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <Input id="password" label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-gray-400">
        <Link href="/forgot-password" className="hover:text-primary transition-colors">Забыли пароль?</Link>
        <span className="mx-2">|</span>
        <Link href="/register" className="hover:text-primary transition-colors">Регистрация</Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}

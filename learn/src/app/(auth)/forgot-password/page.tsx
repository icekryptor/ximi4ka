"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">
          Письмо отправлено
        </h1>
        <p className="text-text-secondary">
          Если аккаунт с email{" "}
          <strong className="text-text-primary">{email}</strong> существует,
          мы отправили ссылку для сброса пароля.
        </p>
        <div className="mt-6">
          <Link href="/login">
            <Button variant="secondary" className="w-full">
              Вернуться к входу
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-2">
        Восстановление пароля
      </h1>
      <p className="text-text-muted text-center text-sm mb-8">
        Введите email — мы пришлём ссылку для сброса
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Отправка..." : "Отправить ссылку"}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-text-muted">
        <Link href="/login" className="text-primary hover:text-primary-hover transition-colors">
          Вернуться к входу
        </Link>
      </div>
    </Card>
  );
}

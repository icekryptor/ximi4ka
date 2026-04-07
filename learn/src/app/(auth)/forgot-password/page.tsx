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
      <Card glass>
        <h1 className="text-2xl font-bold text-center mb-4">Письмо отправлено</h1>
        <p className="text-text-secondary text-center">
          Если аккаунт с email <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.
        </p>
      </Card>
    );
  }

  return (
    <Card glass>
      <h1 className="text-2xl font-bold text-center mb-6">Восстановление пароля</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Отправка..." : "Отправить ссылку"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-primary hover:underline">Вернуться к входу</Link>
      </div>
    </Card>
  );
}

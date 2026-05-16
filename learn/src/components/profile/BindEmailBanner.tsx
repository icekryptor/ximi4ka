"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function BindEmailBanner() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/profile/bind-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("sent");
      setMessage(data.message);
    } else {
      setStatus("error");
      setMessage(data.error || "Ошибка");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 mb-6">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-dark-text">{message}</div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/[0.08] bg-dark-surface p-5 mb-6"
    >
      <div className="flex items-start gap-3 mb-3">
        <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-dark-text mb-1">Привяжи свою почту</h3>
          <p className="text-sm text-dark-text-secondary">
            Это нужно для восстановления пароля. После подтверждения kit-логин
            больше не работает — вход по email.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 rounded-lg bg-white/[0.05] text-dark-text border border-white/10 px-4 py-2 outline-none focus:border-primary/50"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-full text-sm font-semibold text-white px-5 py-2 bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple disabled:opacity-50"
        >
          {status === "loading" ? "..." : "Привязать"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-sm text-error-dark">{message}</p>
      )}
    </form>
  );
}

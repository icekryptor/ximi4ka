"use client";

import { useState } from "react";
import { X, Monitor, Smartphone } from "lucide-react";

type Device = {
  id: string;
  device_id: string;
  user_agent: string | null;
  last_active_at: string;
};

function parseUA(ua: string | null): { label: string; isMobile: boolean } {
  if (!ua) return { label: "Неизвестное устройство", isMobile: false };
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = "Браузер";
  if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edge|Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  const label = [browser, os].filter(Boolean).join(" on ") || ua.slice(0, 40);
  return { label, isMobile };
}

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return `${d} дн назад`;
}

export function DeviceLimitModal({
  devices,
  login,
  password,
  onClose,
  onRemoved,
}: {
  devices: Device[];
  login: string;
  password: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  async function remove(deviceRowId: string) {
    setRemoving(deviceRowId);
    setRemoveError("");
    const res = await fetch("/api/devices/remove-with-creds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password, deviceIdToRemove: deviceRowId }),
    });
    setRemoving(null);
    if (res.ok) {
      onRemoved();
    } else {
      const data = await res.json().catch(() => ({}));
      setRemoveError(data.error || "Не удалось удалить устройство");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-surface border border-white/[0.08] rounded-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-text-muted hover:text-dark-text transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-display text-xl font-bold text-dark-text mb-2">
          Уже залогинено 3 устройства
        </h2>
        <p className="text-sm text-dark-text-secondary mb-5">
          Удалите одно из них, чтобы войти с этого устройства:
        </p>

        <ul className="space-y-2">
          {devices.map((d) => {
            const { label, isMobile } = parseUA(d.user_agent);
            const Icon = isMobile ? Smartphone : Monitor;
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-dark-text truncate">{label}</div>
                  <div className="text-xs text-dark-text-muted">
                    {timeAgo(d.last_active_at)}
                  </div>
                </div>
                <button
                  disabled={removing === d.id}
                  onClick={() => remove(d.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-error/10 text-error-dark hover:bg-error/20 disabled:opacity-50 transition-colors"
                >
                  {removing === d.id ? "..." : "Удалить"}
                </button>
              </li>
            );
          })}
        </ul>

        {removeError && (
          <p className="mt-3 text-sm text-error-dark">{removeError}</p>
        )}
      </div>
    </div>
  );
}

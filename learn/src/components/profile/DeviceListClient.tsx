"use client";

import { useState } from "react";
import { Trash2, Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";

type D = {
  id: string;
  device_id: string;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
};

export function DeviceListClient({ devices: initial }: { devices: D[] }) {
  const [devices, setDevices] = useState(initial);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");
  const router = useRouter();
  const currentDeviceId =
    typeof window !== "undefined"
      ? localStorage.getItem("xim_device_id")
      : null;

  async function remove(id: string, isCurrent: boolean) {
    setRemoving(id);
    setRemoveError("");
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    setRemoving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRemoveError(data.error || "Ошибка удаления");
      return;
    }
    if (isCurrent) {
      // Middleware will catch missing device on next nav and redirect to login
      router.push("/login");
    } else {
      setDevices((prev) => prev.filter((d) => d.id !== id));
    }
  }

  if (devices.length === 0) {
    return <p className="text-dark-text-muted">Активных устройств нет.</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {devices.map((d) => {
          const isCurrent = d.device_id === currentDeviceId;
          const Icon = /Mobile|iPhone|Android/i.test(d.user_agent ?? "")
            ? Smartphone
            : Monitor;
          return (
            <li
              key={d.id}
              className="flex items-center gap-3 p-4 rounded-2xl bg-dark-surface border border-white/[0.08]"
            >
              <Icon className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-dark-text flex items-center gap-2 flex-wrap">
                  <span className="truncate">
                    {(d.user_agent ?? "Неизвестное устройство").slice(0, 60)}
                  </span>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      Это устройство
                    </span>
                  )}
                </div>
                <div className="text-xs text-dark-text-muted mt-0.5">
                  Активен:{" "}
                  {new Date(d.last_active_at).toLocaleString("ru-RU")}
                </div>
              </div>
              <button
                disabled={removing === d.id}
                onClick={() => remove(d.id, isCurrent)}
                className="p-2 rounded-full text-error-dark hover:bg-error/10 disabled:opacity-50 transition-colors"
                aria-label="Удалить устройство"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {removeError && (
        <p className="mt-3 text-sm text-error-dark">{removeError}</p>
      )}
    </>
  );
}

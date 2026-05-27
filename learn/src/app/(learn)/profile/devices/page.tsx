import { createClient, getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DeviceListClient } from "@/components/profile/DeviceListClient";
import { Info } from "lucide-react";

export default async function DevicesPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { data: devices } = await supabase
    .from("user_devices")
    .select("id, device_id, user_agent, last_active_at, created_at")
    .eq("user_id", user.id)
    .order("last_active_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-dark-text mb-2">
        Мои устройства
      </h1>
      <p className="text-dark-text-secondary mb-4">
        Платформа разрешает быть залогиненным с не более чем 3 устройств
        одновременно. Если попробуешь зайти с 4-го — попросим удалить одно из
        текущих.
      </p>

      <div className="flex items-start gap-3 mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/15">
        <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-dark-text-secondary leading-relaxed">
          <strong className="text-dark-text">Важно про браузеры:</strong> один
          физический телефон или компьютер с двумя браузерами (например, Safari и
          Я.Браузер) считается как два устройства. Это потому что каждый браузер
          хранит свой собственный идентификатор. Если очистишь кэш или историю —
          следующий вход создаст ещё одно устройство.
        </div>
      </div>

      <DeviceListClient devices={devices ?? []} />
    </div>
  );
}

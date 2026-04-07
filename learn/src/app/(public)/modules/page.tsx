import { createClient } from "@/lib/supabase/server";
import { ModuleCard } from "@/components/modules/ModuleCard";
import type { Module } from "@/lib/types";

export const metadata = {
  title: "Модули — XimiLearn",
  description: "Каталог учебных модулей по химии",
};

export default async function ModulesPage() {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("*")
    .eq("is_published", true)
    .order("order_index");

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Модули</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(modules as Module[] | null)?.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
      {(!modules || modules.length === 0) && (
        <p className="text-text-secondary text-center py-12">
          Модули скоро появятся. Следите за обновлениями!
        </p>
      )}
    </div>
  );
}

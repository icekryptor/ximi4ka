import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Link href={`/modules/${module.slug}`}>
      <Card
        glass
        neon={module.tier === "premium" ? "magenta" : undefined}
        className="hover:-translate-y-1 cursor-pointer h-full"
      >
        {module.cover_image_url && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-4 bg-white/20">
            <img src={module.cover_image_url} alt={module.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={module.tier === "premium" ? "premium" : "base"}>
            {module.tier === "premium" ? "Продвинутый" : "Базовый"}
          </Badge>
          {module.tier === "premium" && module.price && (
            <span className="text-sm font-mono text-gray-400">{module.price} ₽</span>
          )}
        </div>
        <h3 className="text-lg font-bold mb-1">{module.title}</h3>
        <p className="text-sm text-gray-400 line-clamp-2">{module.description}</p>
      </Card>
    </Link>
  );
}

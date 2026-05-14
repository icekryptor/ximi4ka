import Link from "next/link";
import { FlaskConical, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Module } from "@/lib/types";

interface ModuleCardProps {
  module: Module;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const isPremium = module.tier === "premium";

  return (
    <Link href={`/modules/${module.slug}`}>
      <Card hover className="p-6 h-full cursor-pointer group">
        {module.cover_image_url ? (
          <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-bg-secondary">
            <img
              src={module.cover_image_url}
              alt={module.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          {isPremium ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end">
              <Sparkles className="w-3 h-3" />
              Продвинутый
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
              Базовый
            </span>
          )}
          {isPremium && module.price && (
            <span className="text-sm text-text-muted tabular-nums">{module.price} ₽</span>
          )}
        </div>

        <h3 className="font-display text-lg font-bold text-text-primary mb-1 group-hover:text-primary transition-colors">
          {module.title}
        </h3>
        <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
          {module.description}
        </p>
      </Card>
    </Link>
  );
}

export default ModuleCard;

import { ReactNode } from "react";
import { clsx } from "clsx";
import { Flame, Star, Sparkles } from "lucide-react";

type BadgeVariant = "streak" | "xp" | "premium" | "default";
type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  theme?: "light" | "dark";
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  theme = "light",
  className,
}: BadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold";

  const variants: Record<BadgeVariant, string> = {
    streak: "bg-primary/10 text-primary",
    xp: "bg-primary/10 text-primary tabular-nums font-mono",
    premium:
      "text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end shadow-glow-purple",
    default:
      theme === "light"
        ? "bg-bg-secondary text-text-primary"
        : "bg-white/10 text-dark-text",
  };

  const Icon =
    variant === "streak"
      ? Flame
      : variant === "xp"
        ? Star
        : variant === "premium"
          ? Sparkles
          : null;

  return (
    <span className={clsx(base, variants[variant], className)}>
      {Icon && (
        <Icon
          className={clsx(
            "w-3.5 h-3.5",
            variant === "streak" && "animate-streak-fire"
          )}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;

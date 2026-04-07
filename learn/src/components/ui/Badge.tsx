import { clsx } from "clsx";
import { PixelIcon } from "./PixelIcon";

interface BadgeProps {
  variant?: "base" | "premium" | "streak" | "xp";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "base", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium",
        {
          "bg-primary/10 text-primary": variant === "base",
          "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white shadow-glow-magenta":
            variant === "premium",
          "bg-neon-lime/10 text-neon-lime font-mono": variant === "streak",
          "bg-neon-cyan/10 text-neon-cyan font-mono": variant === "xp",
        },
        className
      )}
    >
      {variant === "streak" && (
        <PixelIcon name="fire" size={14} className="text-neon-orange animate-streak-fire" />
      )}
      {variant === "xp" && (
        <PixelIcon name="star" size={14} className="text-neon-cyan" />
      )}
      {variant === "premium" && (
        <PixelIcon name="crystal" size={14} className="text-white" />
      )}
      {children}
    </span>
  );
}

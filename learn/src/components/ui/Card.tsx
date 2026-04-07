import { clsx } from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  neon?: "cyan" | "magenta" | "lime" | "purple";
}

export function Card({ className, glass, neon, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-3xl p-6 transition-all duration-300",
        glass
          ? "bg-white/[0.12] backdrop-blur-xl border border-white/[0.15] shadow-glass hover:shadow-glass-hover"
          : "bg-surface-dark/80 backdrop-blur-sm border border-white/[0.1] shadow-glass hover:shadow-glass-hover",
        neon === "cyan" && "shadow-glow-cyan border-neon-cyan/30",
        neon === "magenta" && "shadow-glow-magenta border-neon-magenta/30",
        neon === "lime" && "shadow-glow-lime border-neon-lime/30",
        neon === "purple" && "shadow-glow-purple border-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

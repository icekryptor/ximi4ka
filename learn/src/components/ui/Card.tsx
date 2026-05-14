import { ReactNode, HTMLAttributes } from "react";
import { clsx } from "clsx";

type CardProps = {
  children: ReactNode;
  glass?: boolean;
  theme?: "light" | "dark";
  hover?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export function Card({
  children,
  glass = false,
  theme = "light",
  hover = false,
  className,
  ...rest
}: CardProps) {
  const base = "rounded-2xl transition-all duration-200";

  const surface = glass
    ? theme === "light"
      ? "bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass-light"
      : "bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] shadow-glass-dark"
    : theme === "light"
      ? "bg-white border border-border shadow-soft"
      : "bg-dark-surface border border-white/[0.08]";

  const hoverCls = hover
    ? "hover:-translate-y-0.5 hover:shadow-card-hover"
    : "";

  return (
    <div className={clsx(base, surface, hoverCls, className)} {...rest}>
      {children}
    </div>
  );
}

export default Card;

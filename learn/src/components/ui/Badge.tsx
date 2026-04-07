import { clsx } from "clsx";

interface BadgeProps {
  variant?: "base" | "premium" | "streak" | "xp";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "base", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium",
        {
          "bg-primary/10 text-primary": variant === "base",
          "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white":
            variant === "premium",
          "bg-orange-100 text-orange-700": variant === "streak",
          "bg-green-100 text-green-700": variant === "xp",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

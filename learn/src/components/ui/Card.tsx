import { clsx } from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-border p-6",
        glass ? "bg-white/60 backdrop-blur-md" : "bg-white",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

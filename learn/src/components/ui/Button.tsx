import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", glow, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white hover:shadow-glow-purple hover:scale-[1.02]":
              variant === "primary",
            "bg-white/10 backdrop-blur-sm text-gray-100 border border-white/10 hover:bg-white/20 hover:shadow-glass hover:scale-[1.02]":
              variant === "secondary",
            "text-gray-400 hover:text-gray-100 hover:bg-white/10":
              variant === "ghost",
          },
          {
            "text-sm px-4 py-2 rounded-xl": size === "sm",
            "text-base px-6 py-3 rounded-2xl": size === "md",
            "text-lg px-8 py-4 rounded-3xl": size === "lg",
          },
          glow && "animate-pulse-glow",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

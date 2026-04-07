import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end text-white hover:opacity-90":
              variant === "primary",
            "bg-bg-light text-text-dark border border-border hover:bg-gray-100":
              variant === "secondary",
            "text-text-secondary hover:text-text-dark hover:bg-bg-light":
              variant === "ghost",
          },
          {
            "text-sm px-4 py-2 rounded-xl": size === "sm",
            "text-base px-6 py-3 rounded-2xl": size === "md",
            "text-lg px-8 py-4 rounded-3xl": size === "lg",
          },
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

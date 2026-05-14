import { ReactNode, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  glow?: boolean;
  theme?: "light" | "dark";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "primary",
  size = "md",
  glow = false,
  theme = "light",
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-full cursor-pointer transition-all duration-200 active:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes: Record<ButtonSize, string> = {
    sm: "text-sm px-5 py-2.5",
    md: "text-base px-6 py-3",
    lg: "text-base px-8 py-3.5",
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      "text-white bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end hover:shadow-glow-purple",
    secondary:
      theme === "light"
        ? "bg-white text-text-primary border border-border hover:bg-bg-tertiary"
        : "bg-white/10 text-dark-text border border-white/10 hover:bg-white/15",
    ghost:
      theme === "light"
        ? "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
        : "text-dark-text-secondary hover:text-dark-text hover:bg-white/10",
  };

  const glowCls = glow ? "animate-pulse-glow" : "";

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], glowCls, className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;

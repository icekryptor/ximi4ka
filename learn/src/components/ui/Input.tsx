import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type InputProps = {
  label?: string;
  error?: string;
  theme?: "light" | "dark";
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, theme = "light", className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  const base =
    "w-full rounded-lg px-4 py-3 text-base transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/30";

  const surface =
    theme === "light"
      ? "bg-white text-text-primary border border-border placeholder:text-text-muted focus:border-primary"
      : "bg-white/[0.05] text-dark-text border border-white/10 placeholder:text-dark-text-muted focus:border-primary";

  const errCls = error ? "border-error focus:border-error focus:ring-error/20" : "";

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={clsx(
            "block mb-2 text-sm font-medium",
            theme === "light" ? "text-text-secondary" : "text-dark-text-secondary"
          )}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(base, surface, errCls, className)}
        {...rest}
      />
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
});

export default Input;

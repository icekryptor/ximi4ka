import { clsx } from "clsx";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "w-full px-4 py-3 rounded-2xl border bg-white/5 backdrop-blur-sm text-gray-100",
            "placeholder:text-text-secondary/50",
            "focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 focus:border-neon-cyan/50 focus:shadow-glow-cyan",
            "transition-all",
            error ? "border-red-400" : "border-white/10",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

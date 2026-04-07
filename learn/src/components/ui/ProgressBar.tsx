import { clsx } from "clsx";

interface ProgressBarProps {
  value: number;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, className, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={clsx(
        "w-full bg-bg-light rounded-full overflow-hidden",
        size === "sm" ? "h-2" : "h-3",
        className
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end rounded-full transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

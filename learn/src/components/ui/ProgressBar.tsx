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
        "w-full bg-white/30 backdrop-blur-sm rounded-full overflow-hidden border border-white/20",
        size === "sm" ? "h-2" : "h-3",
        className
      )}
    >
      <div
        className="relative h-full bg-gradient-to-r from-neon-cyan via-primary to-primary-gradient-end rounded-full transition-all duration-700 overflow-hidden"
        style={{ width: `${clamped}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
      </div>
    </div>
  );
}

import { clsx } from "clsx";

type ProgressBarProps = {
  value: number;
  max?: number;
  theme?: "light" | "dark";
  showLabel?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  max = 100,
  theme = "light",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const trackCls =
    theme === "light"
      ? "bg-bg-secondary border border-border-subtle"
      : "bg-white/[0.05] border border-white/[0.08]";

  return (
    <div className={clsx("w-full", className)}>
      <div
        className={clsx("relative w-full h-2.5 rounded-full overflow-hidden", trackCls)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full bg-gradient-to-r from-primary-gradient-start to-primary-gradient-end transition-all duration-500 ease-out relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer bg-[length:200%_100%]" />
        </div>
      </div>
      {showLabel && (
        <p
          className={clsx(
            "mt-1.5 text-xs font-mono tabular-nums",
            theme === "light" ? "text-text-secondary" : "text-dark-text-secondary"
          )}
        >
          {value}/{max}
        </p>
      )}
    </div>
  );
}

export default ProgressBar;

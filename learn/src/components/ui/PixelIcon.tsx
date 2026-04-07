import { clsx } from "clsx";

type IconName = "flask" | "atom" | "molecule" | "fire" | "star" | "crystal" | "potion" | "trophy" | "shield";

interface PixelIconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const icons: Record<IconName, React.ReactNode> = {
  flask: (
    <>
      <rect x="6" y="1" width="4" height="1" fill="currentColor" />
      <rect x="5" y="2" width="1" height="4" fill="currentColor" />
      <rect x="10" y="2" width="1" height="4" fill="currentColor" />
      <rect x="4" y="6" width="1" height="1" fill="currentColor" />
      <rect x="11" y="6" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="1" height="2" fill="currentColor" />
      <rect x="12" y="7" width="1" height="2" fill="currentColor" />
      <rect x="2" y="9" width="1" height="3" fill="currentColor" />
      <rect x="13" y="9" width="1" height="3" fill="currentColor" />
      <rect x="2" y="12" width="1" height="2" fill="currentColor" />
      <rect x="13" y="12" width="1" height="2" fill="currentColor" />
      <rect x="3" y="14" width="10" height="1" fill="currentColor" />
      <rect x="6" y="2" width="4" height="1" fill="currentColor" opacity="0.3" />
      <rect x="4" y="10" width="8" height="4" fill="currentColor" opacity="0.15" />
    </>
  ),
  atom: (
    <>
      <rect x="7" y="7" width="2" height="2" fill="currentColor" />
      <rect x="6" y="3" width="1" height="1" fill="currentColor" />
      <rect x="9" y="3" width="1" height="1" fill="currentColor" />
      <rect x="4" y="5" width="1" height="1" fill="currentColor" />
      <rect x="11" y="5" width="1" height="1" fill="currentColor" />
      <rect x="3" y="7" width="1" height="2" fill="currentColor" />
      <rect x="12" y="7" width="1" height="2" fill="currentColor" />
      <rect x="4" y="10" width="1" height="1" fill="currentColor" />
      <rect x="11" y="10" width="1" height="1" fill="currentColor" />
      <rect x="6" y="12" width="1" height="1" fill="currentColor" />
      <rect x="9" y="12" width="1" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="13" y="4" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="2" y="11" width="1" height="1" fill="currentColor" opacity="0.5" />
      <rect x="13" y="11" width="1" height="1" fill="currentColor" opacity="0.5" />
    </>
  ),
  molecule: (
    <>
      <rect x="3" y="3" width="3" height="3" fill="currentColor" />
      <rect x="10" y="3" width="3" height="3" fill="currentColor" />
      <rect x="6" y="10" width="4" height="3" fill="currentColor" />
      <rect x="6" y="4" width="4" height="1" fill="currentColor" opacity="0.5" />
      <rect x="5" y="7" width="1" height="3" fill="currentColor" opacity="0.5" />
      <rect x="10" y="7" width="1" height="3" fill="currentColor" opacity="0.5" />
    </>
  ),
  fire: (
    <>
      <rect x="7" y="1" width="2" height="1" fill="currentColor" />
      <rect x="6" y="2" width="1" height="2" fill="currentColor" />
      <rect x="8" y="2" width="2" height="1" fill="currentColor" />
      <rect x="5" y="4" width="1" height="2" fill="currentColor" />
      <rect x="9" y="3" width="1" height="2" fill="currentColor" />
      <rect x="10" y="5" width="1" height="2" fill="currentColor" />
      <rect x="4" y="6" width="1" height="3" fill="currentColor" />
      <rect x="11" y="7" width="1" height="3" fill="currentColor" />
      <rect x="5" y="9" width="1" height="3" fill="currentColor" />
      <rect x="10" y="10" width="1" height="2" fill="currentColor" />
      <rect x="6" y="12" width="1" height="2" fill="currentColor" />
      <rect x="9" y="12" width="1" height="2" fill="currentColor" />
      <rect x="7" y="14" width="2" height="1" fill="currentColor" />
      <rect x="7" y="5" width="2" height="3" fill="currentColor" opacity="0.4" />
      <rect x="7" y="9" width="2" height="2" fill="currentColor" opacity="0.2" />
    </>
  ),
  star: (
    <>
      <rect x="7" y="1" width="2" height="2" fill="currentColor" />
      <rect x="7" y="3" width="2" height="1" fill="currentColor" />
      <rect x="1" y="5" width="14" height="2" fill="currentColor" />
      <rect x="3" y="7" width="10" height="1" fill="currentColor" />
      <rect x="4" y="8" width="8" height="1" fill="currentColor" />
      <rect x="4" y="9" width="3" height="1" fill="currentColor" />
      <rect x="9" y="9" width="3" height="1" fill="currentColor" />
      <rect x="3" y="10" width="3" height="1" fill="currentColor" />
      <rect x="10" y="10" width="3" height="1" fill="currentColor" />
      <rect x="2" y="11" width="3" height="1" fill="currentColor" />
      <rect x="11" y="11" width="3" height="1" fill="currentColor" />
      <rect x="1" y="12" width="3" height="2" fill="currentColor" />
      <rect x="12" y="12" width="3" height="2" fill="currentColor" />
    </>
  ),
  crystal: (
    <>
      <rect x="7" y="1" width="2" height="1" fill="currentColor" />
      <rect x="6" y="2" width="4" height="1" fill="currentColor" />
      <rect x="5" y="3" width="6" height="1" fill="currentColor" />
      <rect x="4" y="4" width="8" height="2" fill="currentColor" />
      <rect x="3" y="6" width="10" height="3" fill="currentColor" />
      <rect x="4" y="9" width="8" height="2" fill="currentColor" />
      <rect x="5" y="11" width="6" height="1" fill="currentColor" />
      <rect x="6" y="12" width="4" height="1" fill="currentColor" />
      <rect x="7" y="13" width="2" height="1" fill="currentColor" />
      <rect x="6" y="4" width="2" height="3" fill="currentColor" opacity="0.3" />
    </>
  ),
  potion: (
    <>
      <rect x="6" y="1" width="4" height="1" fill="currentColor" />
      <rect x="7" y="2" width="2" height="3" fill="currentColor" />
      <rect x="5" y="5" width="6" height="1" fill="currentColor" />
      <rect x="4" y="6" width="8" height="1" fill="currentColor" />
      <rect x="3" y="7" width="10" height="5" fill="currentColor" />
      <rect x="4" y="12" width="8" height="1" fill="currentColor" />
      <rect x="5" y="13" width="6" height="1" fill="currentColor" />
      <rect x="5" y="8" width="3" height="2" fill="currentColor" opacity="0.3" />
    </>
  ),
  trophy: (
    <>
      <rect x="3" y="1" width="10" height="1" fill="currentColor" />
      <rect x="2" y="2" width="12" height="1" fill="currentColor" />
      <rect x="1" y="3" width="3" height="3" fill="currentColor" />
      <rect x="12" y="3" width="3" height="3" fill="currentColor" />
      <rect x="4" y="3" width="8" height="5" fill="currentColor" />
      <rect x="5" y="8" width="6" height="1" fill="currentColor" />
      <rect x="6" y="9" width="4" height="1" fill="currentColor" />
      <rect x="7" y="10" width="2" height="2" fill="currentColor" />
      <rect x="5" y="12" width="6" height="1" fill="currentColor" />
      <rect x="4" y="13" width="8" height="1" fill="currentColor" />
      <rect x="6" y="4" width="2" height="2" fill="currentColor" opacity="0.3" />
    </>
  ),
  shield: (
    <>
      <rect x="3" y="1" width="10" height="1" fill="currentColor" />
      <rect x="2" y="2" width="12" height="3" fill="currentColor" />
      <rect x="3" y="5" width="10" height="3" fill="currentColor" />
      <rect x="4" y="8" width="8" height="2" fill="currentColor" />
      <rect x="5" y="10" width="6" height="2" fill="currentColor" />
      <rect x="6" y="12" width="4" height="1" fill="currentColor" />
      <rect x="7" y="13" width="2" height="1" fill="currentColor" />
      <rect x="7" y="3" width="2" height="4" fill="currentColor" opacity="0.3" />
      <rect x="5" y="5" width="6" height="1" fill="currentColor" opacity="0.3" />
    </>
  ),
};

export function PixelIcon({ name, size = 32, className }: PixelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={clsx("image-rendering-pixelated", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {icons[name]}
    </svg>
  );
}

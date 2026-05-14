"use client";
import { useEffect, useState } from "react";

type XPPopupProps = {
  amount: number;
  show: boolean;
  onComplete?: () => void;
};

export function XPPopup({ amount, show, onComplete }: XPPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[60]">
      <div className="font-mono font-bold text-4xl text-primary text-glow-purple animate-xp-pop tabular-nums">
        +{amount} XP
      </div>
    </div>
  );
}

export default XPPopup;

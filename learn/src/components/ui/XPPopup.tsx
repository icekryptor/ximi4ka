"use client";

import { useEffect, useState } from "react";

interface XPPopupProps {
  points: number;
  trigger: boolean;
}

export function XPPopup({ points, trigger }: XPPopupProps) {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger && points > 0) {
      setKey((k) => k + 1);
      setShow(true);
      const t = setTimeout(() => setShow(false), 800);
      return () => clearTimeout(t);
    }
  }, [trigger, points]);

  if (!show) return null;

  return (
    <span
      key={key}
      className="inline-block font-mono font-bold text-neon-cyan text-glow-cyan animate-xp-pop"
    >
      +{points} XP
    </span>
  );
}

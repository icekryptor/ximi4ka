"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormulaBlockProps {
  latex: string;
  displayMode?: boolean;
}

export function FormulaBlock({ latex, displayMode = true }: FormulaBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, {
        displayMode,
        throwOnError: false,
        trust: true,
      });
    }
  }, [latex, displayMode]);

  return <div ref={ref} className="my-4 text-center overflow-x-auto" />;
}

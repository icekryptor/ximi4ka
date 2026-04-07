"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface AnimateOnScrollProps {
  children: React.ReactNode;
  animation?: "fade-in-up";
  delay?: number;
  className?: string;
}

export function AnimateOnScroll({
  children,
  animation = "fade-in-up",
  delay = 0,
  className,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx(
        visible ? `animate-${animation}` : "opacity-0",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

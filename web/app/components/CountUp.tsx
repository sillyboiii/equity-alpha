"use client";

import { useEffect, useRef, useState } from "react";

export default function CountUp({
  value,
  decimals = 2,
  duration = 900,
  className = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={`num ${className}`}>
      {value >= 0 ? "+" : ""}
      {display.toFixed(decimals)}
    </span>
  );
}

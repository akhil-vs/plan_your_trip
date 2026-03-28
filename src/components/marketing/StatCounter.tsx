"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  end: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
};

export function StatCounter({
  end,
  label,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  duration = 1.25,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const [revealed, setRevealed] = useState(() => Boolean(reduceMotion));
  const started = useRef(false);

  useEffect(() => {
    if (reduceMotion) setRevealed(true);
  }, [reduceMotion]);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;

    if (reduceMotion) {
      setDisplay(end);
      return;
    }

    const controls = animate(0, end, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (decimals > 0) {
          setDisplay(Number(v.toFixed(decimals)));
        } else {
          setDisplay(Math.round(v));
        }
      },
      onComplete: () => setRevealed(true),
    });

    return () => controls.stop();
  }, [inView, end, duration, decimals, reduceMotion]);

  const formatted =
    decimals > 0
      ? display.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : display.toLocaleString("en-US");

  return (
    <div
      ref={ref}
      className={cn("text-center sm:text-left", className)}
      aria-hidden={revealed ? undefined : true}
    >
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 font-display tabular-nums tracking-tight">
        {prefix}
        {formatted}
        {suffix}
      </p>
      <p className="text-sm text-slate-600 mt-1">{label}</p>
    </div>
  );
}

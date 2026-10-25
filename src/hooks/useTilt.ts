"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Smooth pointer tilt for 3D objects. Lerps toward the pointer in requestAnimationFrame and writes
 * CSS variables (--rx, --ry, --gx, --gy) on the target, so moving the mouse never re-renders React.
 */
export function useTilt(amplitude = 10) {
  const targetRef = useRef<HTMLDivElement>(null);
  const goal = useRef({ rx: 0, ry: 0, gx: 50, gy: 30 });
  const now = useRef({ rx: 0, ry: 0, gx: 50, gy: 30 });
  const frame = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const tick = useCallback(() => {
    const c = now.current;
    const t = goal.current;
    c.rx += (t.rx - c.rx) * 0.12;
    c.ry += (t.ry - c.ry) * 0.12;
    c.gx += (t.gx - c.gx) * 0.12;
    c.gy += (t.gy - c.gy) * 0.12;
    const el = targetRef.current;
    if (el) {
      el.style.setProperty("--rx", `${c.rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${c.ry.toFixed(2)}deg`);
      el.style.setProperty("--gx", `${c.gx.toFixed(1)}%`);
      el.style.setProperty("--gy", `${c.gy.toFixed(1)}%`);
    }
    const settled = Math.abs(t.rx - c.rx) < 0.01 && Math.abs(t.ry - c.ry) < 0.01 && Math.abs(t.gx - c.gx) < 0.1;
    frame.current = settled ? null : requestAnimationFrame(tick);
  }, []);

  const kick = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (reduced.current || e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      goal.current = { rx: (0.5 - py) * amplitude, ry: (px - 0.5) * amplitude * 1.3, gx: px * 100, gy: py * 100 };
      kick();
    },
    [amplitude, kick],
  );

  const onPointerLeave = useCallback(() => {
    goal.current = { rx: 0, ry: 0, gx: 50, gy: 30 };
    kick();
  }, [kick]);

  return { targetRef, onPointerMove, onPointerLeave };
}

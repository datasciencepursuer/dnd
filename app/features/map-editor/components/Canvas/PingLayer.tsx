import { Circle, Group } from "react-konva";
import { memo, useEffect, useRef } from "react";
import type Konva from "konva";
import type { Ping } from "../../types";

interface PingLayerProps {
  pings: Ping[];
}

interface AnimatedPingProps {
  ping: Ping;
}

function AnimatedPing({ ping }: AnimatedPingProps) {
  const outerRef = useRef<Konva.Circle>(null);
  const middleRef = useRef<Konva.Circle>(null);
  const innerRef = useRef<Konva.Circle>(null);

  // Imperative rAF animation — no React state per frame. Only this node's
  // layer redraws; static layers (background, grid, fog) stay untouched.
  // Progress is elapsed-time based, so it runs at native monitor refresh
  // rate and finishes in the same wall-clock time on any display.
  useEffect(() => {
    const startTime = performance.now();
    const duration = 3000;
    let frameId: number;

    const animate = (now: number) => {
      const outer = outerRef.current;
      const middle = middleRef.current;
      const inner = innerRef.current;
      if (!outer || !middle || !inner) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Pulse animation: starts small, grows, then fades
      // Scale: starts at 0.5, grows to 2, then back to 1.5
      const pulseProgress = Math.sin(progress * Math.PI * 3) * 0.3;
      const scale = 0.5 + progress * 1.5 + pulseProgress;

      // Opacity: stays at 1 for first 2 seconds, then fades out
      const opacity = progress > 0.66 ? 1 - (progress - 0.66) * 3 : 1;

      outer.radius(20 * scale);
      outer.opacity(opacity * 0.8);
      middle.radius(12 * scale);
      middle.opacity(opacity * 0.6);
      inner.opacity(opacity);
      outer.getLayer()?.batchDraw();

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [ping.timestamp]);

  return (
    <Group x={ping.x} y={ping.y} listening={false}>
      {/* Outer ring - pulsing */}
      <Circle
        ref={outerRef}
        radius={10}
        stroke={ping.color}
        strokeWidth={3}
        opacity={0.8}
      />
      {/* Middle ring */}
      <Circle
        ref={middleRef}
        radius={6}
        stroke={ping.color}
        strokeWidth={2}
        opacity={0.6}
      />
      {/* Inner dot */}
      <Circle
        ref={innerRef}
        radius={5}
        fill={ping.color}
        opacity={1}
      />
    </Group>
  );
}

export const PingLayer = memo(function PingLayer({ pings }: PingLayerProps) {
  return (
    <>
      {pings.map((ping) => (
        <AnimatedPing key={ping.id} ping={ping} />
      ))}
    </>
  );
});

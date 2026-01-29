import { Circle, Group } from "react-konva";
import { useEffect, useState } from "react";
import type { Ping } from "../../types";

interface PingLayerProps {
  pings: Ping[];
}

interface AnimatedPingProps {
  ping: Ping;
}

function AnimatedPing({ ping }: AnimatedPingProps) {
  const [scale, setScale] = useState(0.5);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Animate the ping over 3 seconds
    const startTime = Date.now();
    const duration = 3000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Pulse animation: starts small, grows, then fades
      // Scale: starts at 0.5, grows to 2, then back to 1.5
      const pulseProgress = Math.sin(progress * Math.PI * 3) * 0.3;
      const baseScale = 0.5 + progress * 1.5;
      setScale(baseScale + pulseProgress);

      // Opacity: stays at 1 for first 2 seconds, then fades out
      if (progress > 0.66) {
        setOpacity(1 - (progress - 0.66) * 3);
      } else {
        setOpacity(1);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [ping.timestamp]);

  return (
    <Group x={ping.x} y={ping.y}>
      {/* Outer ring - pulsing */}
      <Circle
        radius={20 * scale}
        stroke={ping.color}
        strokeWidth={3}
        opacity={opacity * 0.8}
      />
      {/* Middle ring */}
      <Circle
        radius={12 * scale}
        stroke={ping.color}
        strokeWidth={2}
        opacity={opacity * 0.6}
      />
      {/* Inner dot */}
      <Circle
        radius={5}
        fill={ping.color}
        opacity={opacity}
      />
    </Group>
  );
}

export function PingLayer({ pings }: PingLayerProps) {
  return (
    <>
      {pings.map((ping) => (
        <AnimatedPing key={ping.id} ping={ping} />
      ))}
    </>
  );
}

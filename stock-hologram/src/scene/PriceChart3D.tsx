import { useMemo } from "react";
import { Line } from "@react-three/drei";

interface PriceChart3DProps {
  history: number[];
  color: string;
  width?: number;
  height?: number;
}

export function PriceChart3D({ history, color, width = 1.6, height = 0.5 }: PriceChart3DProps) {
  const points = useMemo(() => {
    if (history.length < 2) return [];
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

    return history.map((value, i): [number, number, number] => {
      const x = (i / (history.length - 1)) * width - width / 2;
      const y = ((value - min) / range) * height - height / 2;
      return [x, y, 0];
    });
  }, [history, width, height]);

  if (points.length < 2) return null;

  return (
    <group>
      <Line points={points} color={color} lineWidth={2} transparent opacity={0.9} />
      <Line
        points={[...points, [width / 2, -height / 2, 0], [-width / 2, -height / 2, 0]]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.12}
      />
    </group>
  );
}

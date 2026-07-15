import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PlaneGeometry, type Group } from "three";
import { Billboard, Html } from "@react-three/drei";
import type { Quote } from "../state/types";
import { PriceChart3D } from "./PriceChart3D";

interface StockPanelProps {
  quote: Quote | undefined;
  symbol: string;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
}

export function StockPanel({ quote, symbol, position, selected, onSelect }: StockPanelProps) {
  const frameRef = useRef<Group>(null);
  const up = (quote?.changePct ?? 0) >= 0;
  const color = up ? "#00f0ff" : "#ff4d6d";
  const edgesGeom = useMemo(() => new PlaneGeometry(2, 1.15), []);

  useFrame((state) => {
    if (!frameRef.current) return;
    const bob = Math.sin(state.clock.elapsedTime * 1.2 + position[0]) * 0.03;
    frameRef.current.position.y = bob;
  });

  return (
    <group position={position}>
      <Billboard>
        <group ref={frameRef} onClick={onSelect}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[2, 1.15]} />
            <meshBasicMaterial
              color={selected ? "#083a45" : "#041016"}
              transparent
              opacity={selected ? 0.55 : 0.35}
            />
          </mesh>

          <lineSegments position={[0, 0, -0.005]}>
            <edgesGeometry args={[edgesGeom]} />
            <lineBasicMaterial color={color} transparent opacity={0.8} />
          </lineSegments>

          <Html transform distanceFactor={2.3} position={[0, 0.28, 0.02]} style={{ pointerEvents: "none" }}>
            <div className="panel-readout" style={{ width: 400, color }}>
              <div className="panel-readout-top">
                <span className="panel-symbol">{symbol}</span>
                <span className="panel-pct">
                  {quote ? `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%` : "..."}
                </span>
              </div>
              <div className="panel-price">{quote ? `$${quote.price.toFixed(2)}` : "--"}</div>
            </div>
          </Html>

          <group position={[0, -0.2, 0]}>
            <PriceChart3D history={quote?.history ?? []} color={color} width={1.8} height={0.55} />
          </group>
        </group>
      </Billboard>
    </group>
  );
}

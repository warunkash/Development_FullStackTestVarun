import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

interface CentralCoreProps {
  marketPulse: number; // -1..1, drives color/speed
}

export function CentralCore({ marketPulse }: CentralCoreProps) {
  const outerRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);

  const color = marketPulse >= 0 ? "#00f0ff" : "#ff4d6d";

  const ringGeometries = useMemo(() => [1.15, 1.45, 1.75], []);

  useFrame((_, delta) => {
    if (outerRef.current) outerRef.current.rotation.y += delta * 0.25;
    if (innerRef.current) innerRef.current.rotation.y -= delta * 0.4;
    if (innerRef.current) innerRef.current.rotation.x += delta * 0.15;
  });

  return (
    <group position={[0, 0.2, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
      </mesh>

      <group ref={innerRef}>
        <mesh>
          <octahedronGeometry args={[0.42, 0]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.6} />
        </mesh>
      </group>

      <group ref={outerRef}>
        {ringGeometries.map((radius, i) => (
          <mesh key={radius} rotation={[Math.PI / 2 + i * 0.35, i * 0.6, 0]}>
            <torusGeometry args={[radius, 0.006, 8, 96]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} />
          </mesh>
        ))}
      </group>

      <pointLight color={color} intensity={4} distance={6} />
    </group>
  );
}

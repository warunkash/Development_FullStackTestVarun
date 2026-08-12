import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useAppStore } from "../state/store";
import { GridFloor } from "./GridFloor";
import { CentralCore } from "./CentralCore";
import { Particles } from "./Particles";
import { StockPanel } from "./StockPanel";

export function HologramScene() {
  const watchlist = useAppStore((s) => s.watchlist);
  const quotes = useAppStore((s) => s.quotes);
  const selected = useAppStore((s) => s.selected);
  const select = useAppStore((s) => s.select);

  const marketPulse = useMemo(() => {
    const values = watchlist.map((sym) => quotes[sym]?.changePct ?? 0);
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [watchlist, quotes]);

  const radius = Math.max(3.2, watchlist.length * 0.75);

  return (
    <Canvas camera={{ position: [0, 1.6, 7.5], fov: 50 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#000308"]} />
      <fog attach="fog" args={["#000308", 8, 22]} />

      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 5, 2]} intensity={0.3} color="#00e5ff" />

      <Suspense fallback={null}>
        <GridFloor />
        <Particles />
        <CentralCore marketPulse={marketPulse} />

        {watchlist.map((symbol, i) => {
          const angle = (i / watchlist.length) * Math.PI * 2;
          const x = Math.sin(angle) * radius;
          const z = Math.cos(angle) * radius;
          return (
            <StockPanel
              key={symbol}
              symbol={symbol}
              quote={quotes[symbol]}
              position={[x, 0.4, z]}
              selected={selected === symbol}
              onSelect={() => select(symbol)}
            />
          );
        })}

        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={14}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}

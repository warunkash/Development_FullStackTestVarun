import { Grid } from "@react-three/drei";

export function GridFloor() {
  return (
    <Grid
      position={[0, -3.2, 0]}
      args={[40, 40]}
      cellSize={0.6}
      cellThickness={0.5}
      cellColor="#0b3a4a"
      sectionSize={3}
      sectionThickness={1.2}
      sectionColor="#00e5ff"
      fadeDistance={26}
      fadeStrength={1.5}
      infiniteGrid
    />
  );
}

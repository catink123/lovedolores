import { useFrame } from "@react-three/fiber"
import { useState } from "react";

export function RotatingLight() {
  const [rotation, setRotation] = useState(0);
  useFrame((_state, delta) => {
    setRotation(prev => prev + delta / 3)
  })

  return (
    <group rotation-y={rotation}>
      <directionalLight position={[0, 0, 2]} intensity={1} color="#ffffff">
        <object3D attach="target" position={[0, 0, 0]} />
      </directionalLight>
      <directionalLight position={[0, 0, -2]} intensity={1} color="#ffffff">
        <object3D attach="target" position={[0, 0, 0]} />
      </directionalLight>
    </group>
  )
}
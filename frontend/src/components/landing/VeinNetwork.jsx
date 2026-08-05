import { useFrame } from '@react-three/fiber';

/**
 * The two converging vascular networks.
 *
 * Purely presentational: geometry and material come from useVascular(), and
 * this component's only job each frame is to push the stage clock into the
 * growth shader's uniforms — no React state, no re-renders during animation.
 */
export default function VeinNetwork({ stage, geometry, material, scale = 1 }) {
  useFrame(() => {
    const u = material.uniforms;
    u.uProgress.value = stage.progress;
    u.uTime.value = stage.time;
    u.uPulse.value = stage.pulse;
  });

  return <mesh geometry={geometry} material={material} scale={scale} frustumCulled={false} />;
}

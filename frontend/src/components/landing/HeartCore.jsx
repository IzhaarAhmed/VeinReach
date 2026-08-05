import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildHeart } from './heart.js';
import { buildVeinGeometry } from './veins.js';
import { createVeinMaterial, PALETTE } from './veinMaterial.js';

/** Heart tubes are short and read up close, so they get their own resolution. */
const HEART_CFG = { tubular: 30, radial: 8 };
const HEART_CFG_LOW = { tubular: 18, radial: 6 };

/**
 * Radial glow behind the heart. A shader disc rather than a texture — no asset
 * to load, and the falloff can be tuned to feed the bloom pass precisely.
 */
function createGlowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.hot) },
      uInner: { value: new THREE.Color('#ff5a5a') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform vec3 uColor;
      uniform vec3 uInner;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float core = exp(-d * d * 9.0);
        float halo = exp(-d * d * 2.0);
        vec3 col = mix(uColor, uInner, core);
        gl_FragColor = vec4(col, (core * 0.85 + halo * 0.4) * uIntensity);
      }
    `,
  });
}

/**
 * The heart-like vascular structure the two networks merge into.
 *
 * Formation is driven by `stage.heart` (which only leaves zero once the growth
 * fronts actually reach the centre) and, once formed, by a double-thump
 * heartbeat envelope on `stage.beat` that swells the vessels and the glow
 * together — the visual payoff the whole animation is building toward.
 */
export default function HeartCore({ stage, scale = 1 }) {
  const low = stage.quality === 'low';

  const { geometry, material, glow, glowGeometry } = useMemo(() => {
    const { branches } = buildHeart();
    const cfg = low ? HEART_CFG_LOW : HEART_CFG;
    return {
      // d0/d1 are already normalized 0..1, so maxDist is 1.
      geometry: buildVeinGeometry(branches, 1, cfg),
      material: createVeinMaterial({ breath: stage.reduced ? 0 : 0.03 }),
      glow: createGlowMaterial(),
      glowGeometry: new THREE.PlaneGeometry(1, 1),
    };
  }, [low, stage.reduced]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      glow.dispose();
      glowGeometry.dispose();
    },
    [geometry, material, glow, glowGeometry]
  );

  useFrame(() => {
    const beat = stage.beat;
    const u = material.uniforms;
    u.uProgress.value = stage.heart;
    u.uTime.value = stage.time;
    // Reuse the pulse channel for the heartbeat: a wave that washes out through
    // the heart's own vessels on every thump.
    u.uPulse.value = stage.heart > 0.02 ? (1 - beat) * 1.15 : -1;

    glow.uniforms.uIntensity.value = stage.heart * (0.28 + beat * 0.5) * 0.55;
  });

  return (
    <group scale={scale}>
      <mesh
        geometry={glowGeometry}
        material={glow}
        position={[0, 0, -0.9]}
        scale={[6.2, 6.2, 1]}
        frustumCulled={false}
      />
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

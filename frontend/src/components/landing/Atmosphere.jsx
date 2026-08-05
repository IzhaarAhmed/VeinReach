import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { makeRng } from './veins.js';

/**
 * Ambient fog, volumetric light shafts, and free-floating motes.
 *
 * The "volumetric" light is faked with a couple of huge additive gradient
 * planes drifting behind the network — far cheaper than real light scattering
 * and, once the bloom pass has chewed on it, visually indistinguishable at
 * these densities.
 */

function createHazeMaterial(color, softness) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Depth-tested so the haze stays behind the vessels instead of washing
    // over them when the camera pushes into the network on scroll.
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uSoftness: { value: softness },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uSoftness;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float f = exp(-d * d * uSoftness);
        gl_FragColor = vec4(uColor, f * uOpacity);
      }
    `,
  });
}

export default function Atmosphere({ stage, count = 260 }) {
  const { hazeA, hazeB, plane, motes, moteMat, moteState } = useMemo(() => {
    const rng = makeRng(77123);

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const drift = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rng() - 0.5) * 26;
      positions[i * 3 + 1] = (rng() - 0.5) * 16;
      positions[i * 3 + 2] = (rng() - 0.5) * 12 - 2;
      sizes[i] = 1.5 + rng() * 5;
      drift[i] = 0.12 + rng() * 0.3;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelScale: { value: 16 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color('#8B0000') },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uPixelScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelScale / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          gl_FragColor = vec4(uColor, exp(-d * d * 3.5) * uOpacity);
        }
      `,
    });

    return {
      // Higher softness = tighter falloff, so the glow stays a pool of light
      // near the centre rather than lifting the entire background.
      hazeA: createHazeMaterial('#4A0000', 3.0),
      hazeB: createHazeMaterial('#8B0000', 5.0),
      plane: new THREE.PlaneGeometry(1, 1),
      motes: geo,
      moteMat: mat,
      moteState: { positions, drift, posAttr },
    };
  }, [count]);

  useEffect(
    () => () => {
      hazeA.dispose();
      hazeB.dispose();
      plane.dispose();
      motes.dispose();
      moteMat.dispose();
    },
    [hazeA, hazeB, plane, motes, moteMat]
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = stage.time;

    // Haze breathes with the heartbeat and only arrives once growth is underway.
    // These planes are enormous and additively blended, so they cover the whole
    // frame — a value that looks harmless here reads as a full-screen wash once
    // bloom picks it up. Keep them low enough that the canvas stays near-black.
    const base = 0.028 + stage.progress * 0.045;
    hazeA.uniforms.uOpacity.value = base * (0.85 + Math.sin(t * 0.31) * 0.15);
    hazeB.uniforms.uOpacity.value = (base * 0.5 + stage.heart * 0.05) * (1 + stage.beat * 0.5);
    moteMat.uniforms.uOpacity.value = 0.05 + stage.progress * 0.09;

    const { positions, drift, posAttr } = moteState;
    for (let i = 0; i < drift.length; i += 1) {
      const y = positions[i * 3 + 1] + drift[i] * dt;
      positions[i * 3 + 1] = y > 8 ? -8 : y;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={plane} material={hazeA} position={[0, 0, -6]} scale={[34, 22, 1]} frustumCulled={false} />
      <mesh geometry={plane} material={hazeB} position={[0, -0.4, -4]} scale={[20, 14, 1]} frustumCulled={false} />
      <points geometry={motes} material={moteMat} frustumCulled={false} />
    </group>
  );
}

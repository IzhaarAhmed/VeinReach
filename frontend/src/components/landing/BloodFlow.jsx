import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { makeRng } from './veins.js';
import { PALETTE } from './veinMaterial.js';

/**
 * Glowing cells flowing through the vessels toward the centre.
 *
 * Each particle walks the flow table root → leaf, and because the networks are
 * seeded at the screen edges and branch inward, that walk *is* the journey from
 * the edges to the heart. When a particle reaches the end of a vessel it picks
 * one of that vessel's children at random, so the traffic naturally fans out
 * through the whole tree instead of following fixed tracks.
 *
 * Positions are integrated on the CPU into a single dynamic buffer — a few
 * thousand lerps per frame is nothing next to the draw call it saves, and it
 * keeps the routing logic readable.
 */
export default function BloodFlow({ stage, flow, scale = 1, count = 1400 }) {
  const size = useThree((s) => s.size);

  const { geometry, material, sim } = useMemo(() => {
    const rng = makeRng(4242);
    const branchOf = new Int32Array(count);
    const t = new Float32Array(count);
    const speed = new Float32Array(count);
    const jitter = new Float32Array(count * 3);

    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      branchOf[i] = flow.roots[(rng() * flow.roots.length) | 0];
      t[i] = rng();
      speed[i] = 0.11 + rng() * 0.17;
      sizes[i] = 5 + rng() * 11;
      jitter[i * 3] = (rng() - 0.5) * 0.03;
      jitter[i * 3 + 1] = (rng() - 0.5) * 0.03;
      jitter[i * 3 + 2] = (rng() - 0.5) * 0.03;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const alphaAttr = new THREE.BufferAttribute(alphas, 1);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('aAlpha', alphaAttr);
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelScale: { value: 6 },
        uColor: { value: new THREE.Color(PALETTE.hot) },
        // Core highlight. Kept off pure white: ACES tone mapping desaturates
        // hot pixels toward white, so a near-white core reads as a colourless
        // blob once dozens of additive particles overlap inside one vessel.
        uHot: { value: new THREE.Color('#ff9a9a') },
      },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        uniform float uPixelScale;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelScale / max(-mv.z, 0.001);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.001) discard;
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float a = exp(-d * d * 4.0);
          gl_FragColor = vec4(mix(uColor, uHot, a * a), a * vAlpha);
        }
      `,
    });

    return {
      geometry: geo,
      material: mat,
      sim: { branchOf, t, speed, jitter, positions, alphas, posAttr, alphaAttr },
    };
  }, [flow, count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  // Keep point size in screen pixels stable across viewport heights and DPR.
  // The factor is small on purpose: gl_PointSize divides by view depth, so at
  // the scene's z ≈ 8 this lands each cell at roughly 3-10px. Anything larger
  // and neighbouring particles merge into a solid glowing tube instead of
  // reading as individual cells moving through the vessel.
  useEffect(() => {
    material.uniforms.uPixelScale.value = size.height * 0.007;
  }, [material, size.height]);

  useFrame((_, rawDelta) => {
    const { branchOf, t, speed, jitter, positions, alphas, posAttr, alphaAttr } = sim;
    const { points, d0, d1, children, roots, samples } = flow;

    // Clamp so a backgrounded tab returning doesn't fast-forward the whole flow.
    const dt = Math.min(rawDelta, 0.05);
    const progress = stage.progress;
    const rate = 1 + stage.beat * 1.6; // blood surges on each heartbeat
    const last = samples - 1;

    for (let i = 0; i < branchOf.length; i += 1) {
      let b = branchOf[i];
      let tt = t[i] + speed[i] * dt * rate;

      // Advance into child vessels; respawn at a root once the tree runs out.
      let guard = 0;
      while (tt >= 1 && guard < 4) {
        const kids = children[b];
        b = kids && kids.length
          ? kids[(Math.random() * kids.length) | 0]
          : roots[(Math.random() * roots.length) | 0];
        tt -= 1;
        guard += 1;
      }
      if (tt >= 1) tt -= Math.floor(tt);

      branchOf[i] = b;
      t[i] = tt;

      const s = tt * last;
      const i0 = s | 0;
      const i1 = i0 < last ? i0 + 1 : last;
      const f = s - i0;
      const o0 = (b * samples + i0) * 3;
      const o1 = (b * samples + i1) * 3;
      const o = i * 3;

      positions[o] = points[o0] + (points[o1] - points[o0]) * f + jitter[o];
      positions[o + 1] = points[o0 + 1] + (points[o1 + 1] - points[o0 + 1]) * f + jitter[o + 1];
      positions[o + 2] = points[o0 + 2] + (points[o1 + 2] - points[o0 + 2]) * f + jitter[o + 2];

      // Only visible inside vessels the growth front has already built.
      const dist = d0[b] + (d1[b] - d0[b]) * tt;
      const a = (progress - dist) / 0.06;
      alphas[i] = a <= 0 ? 0 : (a >= 1 ? 1 : a) * stage.flowOpacity;
    }

    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} scale={scale} frustumCulled={false} />;
}

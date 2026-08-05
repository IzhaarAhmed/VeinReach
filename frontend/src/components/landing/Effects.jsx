import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Bloom + colour output.
 *
 * Uses the passes bundled inside `three` itself rather than pulling in
 * @react-three/postprocessing — same result, no extra dependency.
 *
 * The composer always runs, even when bloom is off (low-power devices), because
 * OutputPass is what applies tone mapping and the sRGB conversion. Keeping one
 * pipeline means the vessel shader can emit linear colour unconditionally
 * instead of branching on whether post-processing is active.
 *
 * Rendering at priority 1 takes over R3F's automatic render — which is exactly
 * what we want, and why this component must always be mounted.
 */
/**
 * Threshold is the value that matters most here. Low values bloom *everything*
 * — including the dark crimson vessel bodies and the ambient haze — which turns
 * the whole frame into a pink wash instead of the near-black the design calls
 * for. Keeping it high means only genuinely hot pixels (the pulse front, the
 * heart core, particle centres) glow.
 */
export default function Effects({ bloom = true, strength = 0.55, radius = 0.5, threshold = 0.62 }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    if (bloom) {
      c.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(size.width || 1, size.height || 1),
          strength,
          radius,
          threshold
        )
      );
    }
    c.addPass(new OutputPass());
    return c;
    // Size is applied via setSize below; it must not rebuild the pass chain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, bloom, strength, radius, threshold]);

  useEffect(() => {
    // Cap the post-processing resolution. UnrealBloomPass runs five progressive
    // downsample/upsample passes, so at DPR 2 on a large display it dominates
    // the frame. Bloom is a soft effect — rendering the chain at 1.5x and
    // letting OutputPass blit up is visually indistinguishable and much
    // cheaper, which is what keeps this at 60 FPS on integrated graphics.
    composer.setPixelRatio(Math.min(dpr, bloom ? 1.5 : 1));
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height, dpr, bloom]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}

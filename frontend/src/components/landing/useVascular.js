import { useEffect, useMemo } from 'react';
import { buildNetwork, buildVeinGeometry, buildFlowTable, QUALITY } from './veins.js';
import { createVeinMaterial } from './veinMaterial.js';

/** Canonical build space. Groups are "cover"-scaled to the viewport at runtime. */
export const BASE_SPREAD = 7.5;
export const BASE_HEIGHT = 4.2;

/** Scale that keeps the network spanning the frame on any aspect ratio. */
export function coverScale(viewport) {
  return Math.min(
    1.7,
    Math.max(0.6, viewport.width / (2 * BASE_SPREAD), viewport.height / (2 * BASE_HEIGHT))
  );
}

/**
 * Generate the vascular network once per quality tier and own its GPU lifetime.
 *
 * Deliberately independent of viewport size: resizing rescales the group rather
 * than regenerating geometry, so dragging a window edge never stalls a frame.
 * Returns the merged geometry, its material, and the flow lookup table — the
 * single source of truth shared by the mesh and the particle system.
 */
export function useVascular({ quality, reduced }) {
  const cfg = QUALITY[quality] ?? QUALITY.high;

  const built = useMemo(() => {
    const { branches, maxDist } = buildNetwork({
      spread: BASE_SPREAD,
      height: BASE_HEIGHT,
      cfg,
    });
    return {
      geometry: buildVeinGeometry(branches, maxDist, cfg),
      material: createVeinMaterial({ breath: reduced ? 0 : 0.045 }),
      flow: buildFlowTable(branches, maxDist, cfg),
    };
  }, [cfg, reduced]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  return built;
}

import { useEffect, useState } from 'react';

/**
 * Decide how much scene to render on this device.
 *
 * `low` halves the branch depth, drops bloom, caps DPR at 1.5, and cuts the
 * particle budget by ~70% — the difference between a smooth phone and a hot
 * one. `reduced` skips the animation entirely and paints a single static frame
 * of the fully-grown network.
 */
function detect() {
  if (typeof window === 'undefined') return { reduced: false, quality: 'high' };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const narrow = window.innerWidth < 820;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  return {
    reduced,
    quality: narrow || cores <= 4 || (coarse && window.innerWidth < 1180) ? 'low' : 'high',
  };
}

export default function useQuality() {
  const [state, setState] = useState(detect);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setState(detect());

    motionQuery.addEventListener('change', update);
    // Only react to orientation/major layout changes, not every resize frame.
    const orientation = window.matchMedia('(orientation: portrait)');
    orientation.addEventListener('change', update);

    return () => {
      motionQuery.removeEventListener('change', update);
      orientation.removeEventListener('change', update);
    };
  }, []);

  return state;
}

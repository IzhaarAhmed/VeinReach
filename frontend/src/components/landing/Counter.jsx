import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

const easeOutExpo = (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x));

/**
 * Counts up to `value` the first time it scrolls into view.
 *
 * Writes straight to the DOM node instead of through React state so a 1.8s
 * count-up doesn't schedule ~110 re-renders while the 3D scene is running.
 */
export default function Counter({ value, duration = 1.8, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const reduce = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView || done) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    if (reduce) {
      node.textContent = `${prefix}${value}${suffix}`;
      setDone(true);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      node.textContent = `${prefix}${Math.round(easeOutExpo(t) * value)}${suffix}`;
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, done, reduce, value, duration, prefix, suffix]);

  return (
    <span ref={ref} aria-label={`${prefix}${value}${suffix}`}>
      {`${prefix}0${suffix}`}
    </span>
  );
}

import { motion, useReducedMotion } from 'framer-motion';

/** Expo-out. The single easing curve the whole landing page moves on. */
export const CINEMATIC = [0.16, 1, 0.3, 1];

/**
 * Fade + rise a block into view once, on the shared easing curve.
 *
 * Only opacity and transform are animated — both composited on the GPU, so a
 * page full of these never costs layout or paint work. Honours
 * prefers-reduced-motion by rendering the final state immediately.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 26,
  duration = 0.9,
  className,
  as = 'div',
  ...rest
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] ?? motion.div;

  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className} {...rest}>
        {children}
      </Plain>
    );
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration, delay, ease: CINEMATIC }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

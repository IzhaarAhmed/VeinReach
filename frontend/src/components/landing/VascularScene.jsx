import { Component, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import VeinNetwork from './VeinNetwork.jsx';
import BloodFlow from './BloodFlow.jsx';
import HeartCore from './HeartCore.jsx';
import Atmosphere from './Atmosphere.jsx';
import Effects from './Effects.jsx';
import { useVascular, coverScale } from './useVascular.js';

/* ── Timeline ──────────────────────────────────────────────────────────────
   Growth runs 3.6s edge → centre. The moment the fronts meet, the heart has
   already begun forming (it starts at 80% growth so the merge reads seamless)
   and the first pulse wave fires outward through the whole network. */
const GROW_DURATION = 3.6;
const PULSE_PERIOD = 6.8;
const PULSE_TRAVEL = 1.6;
const BEAT_PERIOD = 3.4;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Cinematic ease: buds slowly, accelerates, decelerates into the meeting. */
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const thump = (x, offset) => Math.exp(-(((x - offset) * 8) ** 2));

/**
 * Advances the shared stage clock. Runs at priority -1 so every other useFrame
 * in the tree reads a consistent, already-updated frame state.
 */
function StageDriver({ stage }) {
  useFrame((_, rawDelta) => {
    // Reduced motion: hold the fully-grown network with no pulse or heartbeat,
    // so the single rendered frame is calm and deterministic.
    if (stage.reduced) {
      stage.progress = 1;
      stage.heart = 1;
      stage.flowOpacity = 1;
      stage.pulse = -1;
      stage.beat = 0;
      return;
    }

    const dt = Math.min(rawDelta, 0.05);
    stage.time += dt;

    // Pointer smoothing, frame-rate independent.
    const k = 1 - Math.exp(-dt * 3.2);
    stage.px += (stage.targetPx - stage.px) * k;
    stage.py += (stage.targetPy - stage.py) * k;
    stage.scroll += (stage.targetScroll - stage.scroll) * (1 - Math.exp(-dt * 4));

    const progress = easeInOutCubic(clamp01(stage.time / GROW_DURATION));
    stage.progress = progress;
    stage.heart = smoothstep(0.8, 1, progress);
    stage.flowOpacity = smoothstep(0.08, 0.42, progress);

    if (progress >= 1) {
      const since = stage.time - GROW_DURATION;

      // Pulse: starts at the centre (aDist 1) and washes out to the edges.
      const pulseCycle = since % PULSE_PERIOD;
      stage.pulse =
        pulseCycle < PULSE_TRAVEL ? 1 - (pulseCycle / PULSE_TRAVEL) * 1.15 : -1;

      // Heartbeat: a lub-dub double thump.
      const beatCycle = since % BEAT_PERIOD;
      stage.beat = thump(beatCycle, 0) + 0.55 * thump(beatCycle, 0.26);
    } else {
      stage.pulse = -1;
      stage.beat = 0;
    }
  }, -1);

  return null;
}

/** Mouse parallax + the slow push through the network on scroll. */
function CameraRig({ stage }) {
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const cam = state.camera;
    const k = 1 - Math.exp(-dt * 2.6);

    const targetX = stage.px * 0.62;
    const targetY = -stage.py * 0.44;
    const targetZ = 8 - stage.scroll * 9.5;

    cam.position.x += (targetX - cam.position.x) * k;
    cam.position.y += (targetY - cam.position.y) * k;
    cam.position.z += (targetZ - cam.position.z) * k;

    // Look slightly against the pointer so the parallax has real depth.
    cam.lookAt(stage.px * -0.16, stage.py * 0.1, 0);
  });

  return null;
}

/** Renders one frame after mount for the reduced-motion / on-demand path. */
function StaticFrame({ active }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return undefined;
    // Two ticks: the first compiles shaders, the second paints the result.
    const id = requestAnimationFrame(() => {
      invalidate();
      requestAnimationFrame(invalidate);
    });
    return () => cancelAnimationFrame(id);
  }, [active, invalidate]);
  return null;
}

/**
 * Drives the scene at a low rate once it is only a backdrop.
 *
 * Below the hero the canvas sits at ~0.28 opacity behind the content, but every
 * useFrame still runs at display rate — the particle system alone steps 1400
 * cells per frame. Switching the canvas to `frameloop="demand"` stops the whole
 * loop, and this ticker re-drives it a few times a second so the vessels keep
 * breathing and the drawing buffer stays defined.
 */
function BackdropTicker({ active, intervalMs = 80 }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return undefined;
    invalidate();
    const id = setInterval(invalidate, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, invalidate]);
  return null;
}

function SceneContents({ stage, backdrop }) {
  const viewport = useThree((s) => s.viewport);
  const { geometry, material, flow } = useVascular(stage);
  const scale = coverScale(viewport);
  const low = stage.quality === 'low';

  return (
    <>
      <StageDriver stage={stage} />
      <CameraRig stage={stage} />
      <Atmosphere stage={stage} count={low ? 110 : 260} />
      <VeinNetwork stage={stage} geometry={geometry} material={material} scale={scale} />
      <BloodFlow stage={stage} flow={flow} scale={scale} count={low ? 420 : 1400} />
      <HeartCore stage={stage} scale={scale * 1.05} />
      <Effects bloom={!low} />
      <StaticFrame active={stage.reduced} />
      <BackdropTicker active={backdrop && !stage.reduced} />
    </>
  );
}

/** If WebGL is unavailable the CSS gradient underneath carries the hero alone. */
class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Fullscreen vascular convergence behind the hero.
 *
 * Owns the shared mutable `stage` object that every 3D component reads from.
 * Nothing here uses React state during animation — pointer, scroll, and the
 * timeline all write into that object, so the render loop never triggers a
 * React re-render.
 */
export default function VascularScene({ reduced = false, quality = 'high' }) {
  const wrapRef = useRef(null);
  // True once the hero has scrolled away and the scene is only a backdrop.
  const [backdrop, setBackdrop] = useState(false);

  const stage = useMemo(
    () => ({
      time: reduced ? GROW_DURATION : 0,
      progress: reduced ? 1 : 0,
      heart: reduced ? 1 : 0,
      flowOpacity: reduced ? 1 : 0,
      pulse: -1,
      beat: 0,
      scroll: 0,
      targetScroll: 0,
      px: 0,
      py: 0,
      targetPx: 0,
      targetPy: 0,
      reduced,
      quality,
    }),
    [reduced, quality]
  );

  useEffect(() => {
    if (reduced) return undefined;

    const onPointerMove = (e) => {
      stage.targetPx = (e.clientX / window.innerWidth - 0.5) * 2;
      stage.targetPy = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    let ticking = false;
    const applyScroll = () => {
      ticking = false;
      const p = clamp01(window.scrollY / Math.max(window.innerHeight, 1));
      stage.targetScroll = p;
      // Recede as the reader moves into the content so text stays legible.
      if (wrapRef.current) wrapRef.current.style.opacity = `${1 - p * 0.72}`;
      // Hysteresis: without the gap, parking the scroll on the boundary would
      // thrash the render loop between modes on every pixel of movement.
      setBackdrop((was) => (was ? p > 0.8 : p > 0.95));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(applyScroll);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    applyScroll();

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [stage, reduced]);

  return (
    <div ref={wrapRef} className="lux-scene" aria-hidden="true">
      <CanvasBoundary>
        <Canvas
          dpr={[1, quality === 'low' ? 1.5 : 2]}
          frameloop={reduced || backdrop ? 'demand' : 'always'}
          camera={{ fov: 42, position: [0, 0, 8], near: 0.1, far: 60 }}
          gl={{
            antialias: quality !== 'low',
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color('#050505'), 1);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.95;
          }}
        >
          <SceneContents stage={stage} backdrop={backdrop} />
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}

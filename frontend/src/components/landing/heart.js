import * as THREE from 'three';
import { makeRng } from './veins.js';

/**
 * The anatomical heart that forms where the two vascular networks meet.
 *
 * Not the symmetric valentine curve — a real heart's silhouette: an asymmetric
 * muscular body, broad at the base, tapering to an apex that points down and to
 * one side, with the great vessels (aorta, pulmonary trunk, vena cava) rising
 * off the top.
 *
 * Drawn in vessels rather than as a solid mesh, which suits the subject: the
 * outer surface of a real heart genuinely is a web of coronary arteries, so the
 * LAD, circumflex and right coronary below are anatomy, not decoration.
 *
 * The outline is split into four arcs that all begin at the two points where
 * the incoming networks arrive (the widest left/right extremes) and grow toward
 * the top and the apex — so the shape reads as something the converging blood
 * built. Output matches what buildVeinGeometry() expects, so the heart and the
 * veins share one geometry builder and one material.
 */

/** Canonical design space, scaled to world units on build. */
const HEART_SCALE = 1.2;
/** Recentres the silhouette on the origin — the camera looks at (0,0,0). */
const Y_OFFSET = -0.173;
/**
 * Anatomical tilt, radians. The heart sits obliquely in the chest with its long
 * axis running down-and-left, and that diagonal is most of what distinguishes
 * it from a symmetric valentine: drawn upright, the same outline reads as a
 * leaf or a teardrop no matter how the border is shaped.
 */
const TILT = -0.34;

/* Silhouette landmarks, viewer's perspective.
   Proportions matter more than any single point: a real heart is roughly as
   wide as it is tall, widest across the upper third, and ends in a BLUNT apex
   sitting left of centre. Making it narrow or sharply pointed is what turns
   the shape back into a teardrop. */
const CONTACT_R = [0.95, 0.08];
const CONTACT_L = [-0.98, 0.15];
const TOP = [0.04, 0.66];
const APEX = [-0.26, -1.15];

/** Outer myocardial border, as four arcs radiating from the two contacts. */
const OUTLINE = [
  // Right contact → over the right atrium → base.
  [CONTACT_R, [0.93, 0.34], [0.82, 0.55], [0.56, 0.7], [0.28, 0.72], TOP],
  // Left contact → over the atrial appendage → base.
  [CONTACT_L, [-0.95, 0.42], [-0.82, 0.62], [-0.54, 0.76], [-0.24, 0.74], TOP],
  // Left contact → down the bulging left ventricle → apex.
  [CONTACT_L, [-0.99, -0.16], [-0.9, -0.52], [-0.72, -0.82], [-0.5, -1.03], [-0.34, -1.13], APEX],
  // Right contact → down the right ventricle → apex. Steeper than the left,
  // which is what gives the silhouette its asymmetry.
  [CONTACT_R, [0.89, -0.22], [0.74, -0.55], [0.5, -0.82], [0.14, -1.03], [-0.1, -1.14], APEX],
];

/** Great vessels rising off the base. */
const GREAT_VESSELS = [
  // Aortic arch — the signature curve, up and over then back down.
  {
    pts: [[0.06, 0.68], [0.2, 1.04], [0.02, 1.32], [-0.28, 1.3], [-0.42, 1.06], [-0.46, 0.84]],
    r0: 0.07,
    r1: 0.05,
  },
  // Pulmonary trunk.
  { pts: [[-0.28, 0.74], [-0.46, 1.02], [-0.62, 1.26]], r0: 0.058, r1: 0.042 },
  // Superior vena cava.
  { pts: [[0.55, 0.7], [0.68, 0.98], [0.76, 1.26]], r0: 0.05, r1: 0.038 },
];

/** Coronary arteries on the muscle surface. */
const CORONARIES = [
  // Left anterior descending — runs obliquely across the front to the apex.
  // Deliberately off-centre: a vessel straight down the middle reads as a leaf
  // midrib and undoes the silhouette.
  { pts: [[0.22, 0.54], [0.06, 0.16], [-0.08, -0.26], [-0.2, -0.68], [-0.26, -1.0]], r0: 0.03, r1: 0.014 },
  // Diagonal branches off the LAD, all on the ventricular side.
  { pts: [[0.04, 0.06], [-0.22, -0.12], [-0.44, -0.3]], r0: 0.02, r1: 0.01 },
  { pts: [[-0.14, -0.46], [-0.36, -0.64], [-0.52, -0.82]], r0: 0.018, r1: 0.009 },
  // Circumflex — wraps the left border.
  { pts: [[-0.1, 0.58], [-0.48, 0.38], [-0.76, 0.1], [-0.86, -0.2]], r0: 0.026, r1: 0.013 },
  // Right coronary — down the right atrioventricular groove.
  { pts: [[0.3, 0.6], [0.62, 0.38], [0.8, 0.05], [0.74, -0.3]], r0: 0.028, r1: 0.014 },
  // Marginal branch.
  { pts: [[0.76, -0.1], [0.58, -0.44], [0.4, -0.7]], r0: 0.018, r1: 0.009 },
];

const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);

function toVec([x, y], { scale = HEART_SCALE, z = 0, shrink = 1 } = {}) {
  // Centre first, then rotate about the origin, so the tilt cannot push the
  // silhouette off the point the camera is aimed at.
  const px = x * shrink;
  const py = y * shrink + Y_OFFSET;
  return new THREE.Vector3((px * COS_T - py * SIN_T) * scale, (px * SIN_T + py * COS_T) * scale, z);
}

function curveFrom(points, opts) {
  return new THREE.CatmullRomCurve3(
    points.map((p) => toVec(p, opts)),
    false,
    'catmullrom',
    0.5
  );
}

/**
 * @returns {{ branches: object[], contacts: THREE.Vector3[] }}
 *   contacts are the two arrival points, so the caller can aim the incoming
 *   networks and the volumetric glow at them.
 */
export function buildHeart({ seed = 991 } = {}) {
  const rng = makeRng(seed);
  const branches = [];

  const push = (curve, r0, r1, d0, d1) =>
    branches.push({ curve, r0, r1, d0, d1, phase: rng() * Math.PI * 2, depth: 0, children: [] });

  // ── Outer border ────────────────────────────────────────────────────────
  // The two arcs that climb to the top finish a little early; the pair running
  // down to the apex carry the trace all the way to 1.
  const outlineEnds = [0.84, 0.84, 1, 1];
  OUTLINE.forEach((pts, i) => {
    push(curveFrom(pts, { z: 0 }), 0.058, 0.044, 0, outlineEnds[i]);
  });

  // No inner echo outline: a second border inside the first is exactly what
  // makes the shape read as a leaf. Interior detail comes from the coronaries.

  // ── Great vessels ───────────────────────────────────────────────────────
  // Start once the base is drawn, so they appear to grow out of the heart.
  for (const v of GREAT_VESSELS) {
    push(curveFrom(v.pts, { z: 0.02 }), v.r0, v.r1, 0.5, 1);
  }

  // ── Coronaries ──────────────────────────────────────────────────────────
  // Slightly forward of the outline: these sit on the muscle's front surface.
  for (const c of CORONARIES) {
    push(curveFrom(c.pts, { z: 0.1 }), c.r0, c.r1, 0.22, 0.86 + rng() * 0.12);
  }

  return { branches, contacts: [toVec(CONTACT_R), toVec(CONTACT_L)] };
}

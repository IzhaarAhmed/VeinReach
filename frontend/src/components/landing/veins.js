import * as THREE from 'three';

/**
 * Procedural vascular network generation.
 *
 * Two networks are seeded off the extreme left and right edges of the frame and
 * branch organically inward. Everything here is pure geometry math — no React,
 * no side effects — so it can be memoized per viewport and unit-reasoned about.
 *
 * The output is a SINGLE merged BufferGeometry per side (one draw call) carrying
 * two custom attributes that drive the growth shader:
 *
 *   aCenter — the centreline point the surface vertex was extruded from.
 *             Collapsing a vertex onto aCenter gives zero radius, so the vessel
 *             can "grow" out of nothing instead of being clipped into existence.
 *   aDist   — normalized 0..1 arc distance from the seed at the screen edge.
 *             The shader reveals everything with aDist <= uProgress, so growth
 *             propagates outward from the edges exactly like vascular budding.
 */

/** Deterministic PRNG (mulberry32) — a fixed seed keeps the network stable across remounts/HMR. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quality presets. Mobile trades branch depth and tube resolution for frame budget. */
export const QUALITY = {
  high: { trunks: 4, maxDepth: 5, tubular: 26, radial: 7, samples: 32 },
  low: { trunks: 3, maxDepth: 4, tubular: 16, radial: 5, samples: 20 },
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Where the networks stop branching and the heart takes over. Matches the x of
 * the heart curve's widest points (see heart.js) so the hand-off lands on the
 * structure's shoulders rather than inside it.
 */
const HEART_CONTACT_X = 0.95;

/**
 * Grow one vessel segment and, recursively, its children.
 *
 * Each segment is a Catmull-Rom curve whose control points drift with layered
 * sine perturbation (organic waviness) while steering toward the centre of the
 * frame, so the whole network converges instead of sprawling.
 */
function growBranch(ctx, { origin, dir, radius, length, depth, dist }) {
  const { rng, cfg, branches, side } = ctx;

  const CTRL = 5;
  const points = [];
  const pos = origin.clone();
  const heading = dir.clone().normalize();

  // Perpendicular basis for the waviness offsets.
  const perp = new THREE.Vector3(-heading.y, heading.x, 0).normalize();
  const phase = rng() * Math.PI * 2;
  const wave = (0.16 + rng() * 0.2) * length;
  const step = length / (CTRL - 1);

  for (let i = 0; i < CTRL; i += 1) {
    const t = i / (CTRL - 1);
    // Steer toward the centre — stronger with depth so capillaries converge hard.
    const toCentre = new THREE.Vector3(-pos.x, -pos.y * 0.35, 0).normalize();
    heading.lerp(toCentre, 0.06 + depth * 0.035).normalize();

    const p = pos.clone();
    p.addScaledVector(perp, Math.sin(phase + t * 3.4) * wave * (1 - t * 0.45));
    p.z += Math.sin(phase * 1.7 + t * 2.2) * 0.35;
    points.push(p);

    if (i < CTRL - 1) pos.addScaledVector(heading, step);
  }

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const arc = curve.getLength();

  const branch = {
    curve,
    r0: radius,
    r1: radius * 0.7,
    d0: dist,
    d1: dist + arc,
    depth,
    children: [],
    phase,
  };
  const index = branches.length;
  branches.push(branch);

  if (depth >= cfg.maxDepth) return index;

  const end = points[points.length - 1];
  // Stop branching once a vessel reaches the heart's contact shoulders (its
  // widest points sit at x = ±1.2). The network then visibly hands off to the
  // heart instead of tangling through the middle of it.
  if (side * end.x < HEART_CONTACT_X) return index;

  const kids = depth < cfg.maxDepth - 1 ? 2 : 1 + (rng() < 0.4 ? 1 : 0);
  for (let i = 0; i < kids; i += 1) {
    const spreadAngle = lerp(0.5, 0.16, depth / cfg.maxDepth);
    const angle = (i - (kids - 1) / 2) * spreadAngle + (rng() - 0.5) * 0.28;
    const childDir = heading
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      .normalize();

    const childIndex = growBranch(ctx, {
      origin: end.clone(),
      dir: childDir,
      radius: branch.r1 * lerp(0.86, 0.68, rng()),
      length: length * lerp(0.82, 0.64, rng()),
      depth: depth + 1,
      dist: branch.d1,
    });
    branch.children.push(childIndex);
  }

  return index;
}

/**
 * Build both vascular networks.
 *
 * @param {object} opts
 * @param {number} opts.spread  half-width of the frame in world units (seed x = ±spread)
 * @param {number} opts.height  half-height of the frame in world units
 * @param {object} opts.cfg     a QUALITY preset
 * @returns {{ branches: object[], maxDist: number }}
 */
export function buildNetwork({ spread, height, cfg, seed = 20240807 }) {
  const rng = makeRng(seed);
  const branches = [];

  for (const side of [-1, 1]) {
    const ctx = { rng, cfg, branches, side };
    for (let i = 0; i < cfg.trunks; i += 1) {
      // Spread trunks vertically across the edge, slightly staggered per side.
      const spanT = cfg.trunks === 1 ? 0.5 : i / (cfg.trunks - 1);
      const y = lerp(-height * 0.72, height * 0.72, spanT) + (rng() - 0.5) * height * 0.16;

      const origin = new THREE.Vector3(side * spread, y, (rng() - 0.5) * 1.6);
      // Aim inward and gently toward the midline.
      const dir = new THREE.Vector3(-side, -y * 0.06 + (rng() - 0.5) * 0.25, 0);

      growBranch(ctx, {
        origin,
        dir,
        radius: 0.075 + rng() * 0.03,
        length: spread * (0.3 + rng() * 0.08),
        depth: 0,
        dist: 0,
      });
    }
  }

  const maxDist = branches.reduce((m, b) => Math.max(m, b.d1), 0);
  return { branches, maxDist };
}

/**
 * Extrude the branch set into one merged, tapered tube geometry.
 *
 * Written by hand rather than via TubeGeometry because TubeGeometry has a
 * constant radius — the taper from trunk to capillary is most of what sells the
 * "anatomical" read — and because we need the aCenter/aDist attributes baked in.
 */
export function buildVeinGeometry(branches, maxDist, cfg) {
  const { tubular, radial } = cfg;
  const ringVerts = radial + 1;

  let vertexCount = 0;
  let indexCount = 0;
  for (let i = 0; i < branches.length; i += 1) {
    vertexCount += (tubular + 1) * ringVerts;
    indexCount += tubular * radial * 6;
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const centers = new Float32Array(vertexCount * 3);
  const dists = new Float32Array(vertexCount);
  const indices = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount);

  let v = 0;
  let idx = 0;

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();

  for (let b = 0; b < branches.length; b += 1) {
    const branch = branches[b];
    const { curve, r0, r1, d0, d1, phase } = branch;
    const frames = curve.computeFrenetFrames(tubular, false);
    const baseVertex = v;

    for (let i = 0; i <= tubular; i += 1) {
      const t = i / tubular;
      curve.getPointAt(t, P);

      // Taper trunk → capillary, with a light organic bulge so it isn't a cone.
      const radius = lerp(r0, r1, t) * (1 + 0.13 * Math.sin(phase + t * 9.0));
      const dist = lerp(d0, d1, t) / maxDist;

      const normal = frames.normals[i];
      const binormal = frames.binormals[i];

      for (let j = 0; j <= radial; j += 1) {
        const a = (j / radial) * Math.PI * 2;
        const sin = Math.sin(a);
        const cos = -Math.cos(a);

        N.set(
          cos * normal.x + sin * binormal.x,
          cos * normal.y + sin * binormal.y,
          cos * normal.z + sin * binormal.z
        ).normalize();

        const o = v * 3;
        positions[o] = P.x + N.x * radius;
        positions[o + 1] = P.y + N.y * radius;
        positions[o + 2] = P.z + N.z * radius;
        normals[o] = N.x;
        normals[o + 1] = N.y;
        normals[o + 2] = N.z;
        centers[o] = P.x;
        centers[o + 1] = P.y;
        centers[o + 2] = P.z;
        dists[v] = dist;
        v += 1;
      }
    }

    for (let i = 0; i < tubular; i += 1) {
      for (let j = 0; j < radial; j += 1) {
        const a = baseVertex + i * ringVerts + j;
        const b1 = a + ringVerts;
        indices[idx] = a;
        indices[idx + 1] = b1;
        indices[idx + 2] = a + 1;
        indices[idx + 3] = b1;
        indices[idx + 4] = b1 + 1;
        indices[idx + 5] = a + 1;
        idx += 6;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('aDist', new THREE.BufferAttribute(dists, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Flatten the branch set into a lookup table the particle system can walk:
 * evenly spaced samples per branch plus the child links, so a particle can flow
 * root → leaf (edge → centre) exactly the way blood moves inward.
 */
export function buildFlowTable(branches, maxDist, cfg) {
  const S = cfg.samples;
  const points = new Float32Array(branches.length * S * 3);
  const d0 = new Float32Array(branches.length);
  const d1 = new Float32Array(branches.length);
  const children = [];
  const roots = [];

  const P = new THREE.Vector3();
  for (let b = 0; b < branches.length; b += 1) {
    const branch = branches[b];
    for (let i = 0; i < S; i += 1) {
      branch.curve.getPointAt(i / (S - 1), P);
      const o = (b * S + i) * 3;
      points[o] = P.x;
      points[o + 1] = P.y;
      points[o + 2] = P.z;
    }
    d0[b] = branch.d0 / maxDist;
    d1[b] = branch.d1 / maxDist;
    children.push(branch.children);
    if (branch.depth === 0) roots.push(b);
  }

  return { points, d0, d1, children, roots, samples: S };
}

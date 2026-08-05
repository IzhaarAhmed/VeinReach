import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNetwork,
  buildVeinGeometry,
  buildFlowTable,
  QUALITY,
} from '../src/components/landing/veins.js';
import { buildHeart } from '../src/components/landing/heart.js';

/**
 * The landing page's vascular geometry is generated procedurally, which means
 * a bad constant produces NaN vertices or an index-buffer overflow that only
 * shows up as an invisible or corrupted scene in the browser. These assertions
 * catch that in a second, without a GPU.
 */

const firstNonFinite = (arr) => {
  for (let i = 0; i < arr.length; i += 1) if (!Number.isFinite(arr[i])) return i;
  return -1;
};

for (const tier of ['high', 'low']) {
  test(`vein network (${tier}) generates valid geometry`, () => {
    const cfg = QUALITY[tier];
    const { branches, maxDist } = buildNetwork({ spread: 7.5, height: 4.2, cfg });
    const geo = buildVeinGeometry(branches, maxDist, cfg);

    const pos = geo.attributes.position.array;
    const dist = geo.attributes.aDist.array;
    const index = geo.index.array;
    const vertexCount = pos.length / 3;

    assert.equal(firstNonFinite(pos), -1, 'positions must all be finite');
    assert.equal(firstNonFinite(geo.attributes.aCenter.array), -1, 'centres must be finite');
    assert.equal(firstNonFinite(dist), -1, 'growth distances must be finite');

    // aDist drives the growth shader; outside 0..1 the vessel never reveals.
    assert.ok(
      dist.every((d) => d >= 0 && d <= 1.0001),
      'growth distances must be normalized to 0..1'
    );
    assert.ok(Math.max(...dist) > 0.98, 'growth must reach the centre');
    assert.ok(Math.min(...dist) < 0.001, 'growth must start at the screen edge');

    // A 16-bit index buffer silently wraps past 65535 vertices.
    let maxIndex = 0;
    for (let i = 0; i < index.length; i += 1) if (index[i] > maxIndex) maxIndex = index[i];
    assert.ok(maxIndex < vertexCount, 'indices must stay within the vertex range');
    if (vertexCount > 65535) {
      assert.equal(index.BYTES_PER_ELEMENT, 4, 'must widen to a 32-bit index buffer');
    }

    geo.dispose();
  });

  test(`flow table (${tier}) is walkable by the particle system`, () => {
    const cfg = QUALITY[tier];
    const { branches, maxDist } = buildNetwork({ spread: 7.5, height: 4.2, cfg });
    const flow = buildFlowTable(branches, maxDist, cfg);

    assert.equal(firstNonFinite(flow.points), -1, 'sampled points must be finite');
    assert.equal(flow.roots.length, cfg.trunks * 2, 'both sides must seed trunks');
    assert.ok(
      flow.children.every((kids) => kids.every((k) => k >= 0 && k < branches.length)),
      'child links must reference real branches'
    );
    assert.ok(
      flow.children.some((kids) => kids.length === 0),
      'leaves must exist so particles can respawn'
    );
    assert.ok(
      flow.d0.every((d, i) => d <= flow.d1[i]),
      'each vessel must run outward from its parent'
    );
  });
}

test('vein networks span both edges and converge on the centre', () => {
  const cfg = QUALITY.high;
  const { branches, maxDist } = buildNetwork({ spread: 7.5, height: 4.2, cfg });
  const geo = buildVeinGeometry(branches, maxDist, cfg);
  const centers = geo.attributes.aCenter.array;

  const xs = [];
  for (let i = 0; i < centers.length; i += 3) xs.push(centers[i]);

  assert.ok(Math.min(...xs) < -6.5, 'must seed off the left edge');
  assert.ok(Math.max(...xs) > 6.5, 'must seed off the right edge');
  assert.ok(Math.min(...xs.map(Math.abs)) < 1.3, 'must converge on the heart');

  geo.dispose();
});

test('heart forms centred on the origin, traced from both contacts', () => {
  // The silhouette is anatomical, so it is deliberately NOT mirror-symmetric —
  // the apex sits off-centre and the great vessels rise from one side.
  const { branches, contacts } = buildHeart();
  const geo = buildVeinGeometry(branches, 1, { tubular: 30, radial: 8 });
  const pos = geo.attributes.position.array;
  const dist = geo.attributes.aDist.array;

  assert.equal(firstNonFinite(pos), -1, 'heart positions must be finite');
  assert.ok(
    dist.every((d) => d >= 0 && d <= 1.0001),
    'heart trace must be normalized'
  );
  assert.ok(Math.min(...dist) < 0.001 && Math.max(...dist) > 0.98, 'heart must trace end to end');

  // The networks arrive from opposite sides, at comparable reach, without
  // requiring the mirror symmetry a valentine shape would have.
  const [right, left] = contacts;
  assert.ok(right.x > 0 && left.x < 0, 'arrivals must be on opposite sides');
  assert.ok(
    Math.abs(Math.abs(right.x) - Math.abs(left.x)) < 0.25,
    `arrival reach should be comparable (got ${right.x.toFixed(2)} / ${left.x.toFixed(2)})`
  );

  const ys = [];
  for (let i = 1; i < pos.length; i += 3) ys.push(pos[i]);
  const centreY = (Math.max(...ys) + Math.min(...ys)) / 2;
  // The camera looks at (0,0,0) — an off-centre heart reads as bad framing.
  assert.ok(Math.abs(centreY) < 0.1, `heart must be vertically centred (got ${centreY.toFixed(3)})`);

  geo.dispose();
});

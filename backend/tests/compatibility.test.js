import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCompatible,
  compatibleDonorGroups,
  matchRank,
} from '../src/services/compatibility.service.js';

test('O- is universal donor', () => {
  for (const rg of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) {
    assert.ok(isCompatible('O-', rg), `O- should donate to ${rg}`);
  }
});

test('AB+ is universal recipient', () => {
  assert.deepEqual(
    compatibleDonorGroups('AB+').sort(),
    ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-'].sort()
  );
});

test('O+ recipient can only receive O+ and O-', () => {
  assert.deepEqual(compatibleDonorGroups('O+').sort(), ['O+', 'O-'].sort());
});

test('A+ cannot donate to A-', () => {
  assert.equal(isCompatible('A+', 'A-'), false);
});

test('exact match ranks above compatible', () => {
  assert.equal(matchRank('A+', 'A+'), 0);
  assert.equal(matchRank('O-', 'A+'), 1);
  assert.equal(matchRank('A+', 'O+'), Infinity);
});

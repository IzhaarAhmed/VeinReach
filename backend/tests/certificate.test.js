import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCertificateSvg } from '../src/services/certificate.service.js';

const baseDonation = {
  _id: '64b0f1a2c3d4e5f6a7b8c9d0',
  bloodGroup: 'O-',
  hospitalName: 'City General',
  verifiedAt: new Date('2026-07-20T00:00:00Z'),
  donor: { fullName: 'Ada Lovelace' },
};

test('certificate renders a valid SVG with the donor + blood group', () => {
  const svg = renderCertificateSvg(baseDonation);
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg[\s\S]*<\/svg>\s*$/);
  assert.ok(svg.includes('Ada Lovelace'));
  assert.ok(svg.includes('O-'));
  assert.ok(svg.includes('City General'));
});

test('certificate number is derived from the donation id', () => {
  const svg = renderCertificateSvg(baseDonation);
  assert.ok(svg.includes('VR-A7B8C9D0'));
});

test('certificate escapes XSS-y donor names', () => {
  const svg = renderCertificateSvg({
    ...baseDonation,
    donor: { fullName: '<script>alert(1)</script>' },
  });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});

test('certificate falls back to a placeholder donor name', () => {
  const svg = renderCertificateSvg({ ...baseDonation, donor: undefined });
  assert.ok(svg.includes('A generous donor'));
});

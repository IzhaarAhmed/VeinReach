import * as donationRepo from '../repositories/donation.repository.js';
import * as storage from './storage.service.js';
import { ApiError } from '../utils/ApiError.js';

const idOf = (v) => String(v?._id ?? v);
const esc = (s = '') =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Render a self-contained SVG donation certificate. SVG keeps this dependency
 * free (no PDF/headless-browser toolchain) while remaining printable and
 * embeddable; a client can convert to PDF if needed.
 */
export function renderCertificateSvg(donation) {
  const donorName = esc(donation.donor?.fullName || 'A generous donor');
  const bloodGroup = esc(donation.bloodGroup);
  const hospital = esc(donation.hospitalName);
  const date = fmtDate(donation.verifiedAt || donation.createdAt || Date.now());
  const ref = esc(idOf(donation)).slice(-8).toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1123" height="794" viewBox="0 0 1123 794" role="img" aria-label="VeinReach donation certificate">
  <rect width="1123" height="794" fill="#fff7f7"/>
  <rect x="24" y="24" width="1075" height="746" fill="none" stroke="#b91c1c" stroke-width="4"/>
  <rect x="40" y="40" width="1043" height="714" fill="none" stroke="#fca5a5" stroke-width="2"/>
  <text x="561" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#7f1d1d" letter-spacing="6">VEINREACH</text>
  <text x="561" y="210" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#b91c1c" font-weight="bold">Certificate of Blood Donation</text>
  <text x="561" y="270" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#555">This certificate is proudly presented to</text>
  <text x="561" y="345" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="#111" font-weight="bold">${donorName}</text>
  <line x1="330" y1="365" x2="793" y2="365" stroke="#e5b4b4" stroke-width="2"/>
  <text x="561" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#444">for the voluntary donation of <tspan fill="#b91c1c" font-weight="bold">${bloodGroup}</tspan> blood</text>
  <text x="561" y="466" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#444">at ${hospital}</text>
  <text x="561" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#666">helping save a life in the community.</text>
  <text x="230" y="670" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#333">${esc(date)}</text>
  <line x1="120" y1="690" x2="340" y2="690" stroke="#999" stroke-width="1"/>
  <text x="230" y="712" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#777">Date of Donation</text>
  <text x="893" y="670" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#333">VeinReach Verified</text>
  <line x1="783" y1="690" x2="1003" y2="690" stroke="#999" stroke-width="1"/>
  <text x="893" y="712" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#777">Authorized by Platform</text>
  <text x="561" y="742" text-anchor="middle" font-family="monospace" font-size="13" fill="#999">Certificate No. VR-${ref}</text>
</svg>`;
}

/**
 * Generate (once) and store a donation's certificate. Idempotent — returns the
 * existing certificate if already issued. Only verified donations qualify.
 * Stores the SVG in R2; when storage is disabled it falls back to an inline
 * data URL so the certificate is still viewable in dev.
 */
export async function issueCertificate(donation) {
  if (donation.status !== 'verified')
    throw ApiError.badRequest('A certificate is only issued for a verified donation');
  if (donation.certificate?.key || donation.certificate?.url) return donation.certificate;

  // The certificate prints the donor's name — populate it if the caller passed
  // a freshly-created (unpopulated) donation doc.
  if (donation.donor && !donation.donor.fullName && typeof donation.populate === 'function')
    await donation.populate({ path: 'donor', select: 'fullName' });

  const svg = renderCertificateSvg(donation);
  const key = `certificate/${idOf(donation.donor)}/${idOf(donation)}.svg`;

  const stored = await storage.putObject({ key, body: svg, contentType: 'image/svg+xml' });

  donation.certificate = stored
    ? { key: stored.key, url: stored.url, issuedAt: new Date() }
    : {
        // Dev fallback: keep the certificate inline so it still renders.
        url: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        issuedAt: new Date(),
      };
  await donationRepo.save(donation);
  return donation.certificate;
}

/**
 * Ensure a certificate exists for a donation the caller is party to, and return
 * a viewable URL (public CDN URL, presigned URL, or the inline dev fallback).
 */
export async function getCertificateUrl(userId, donationId) {
  const donation = await donationRepo.findById(donationId);
  if (!donation) throw ApiError.notFound('Donation not found');

  const isParty =
    idOf(donation.donor) === String(userId) || idOf(donation.recipient) === String(userId);
  if (!isParty) throw ApiError.forbidden('Not your donation');

  const cert = await issueCertificate(donation);
  const url = cert.url || (cert.key ? await storage.createDownloadUrl(cert.key) : null);
  if (!url) throw new ApiError(503, 'Certificate storage is not configured on this server');
  return { url, issuedAt: cert.issuedAt };
}

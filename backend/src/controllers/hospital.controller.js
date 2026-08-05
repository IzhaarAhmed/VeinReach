import * as hospitalService from '../services/hospital.service.js';
import * as donorService from '../services/donor.service.js';
import { ok, asyncHandler } from '../utils/response.js';

export const donations = asyncHandler(async (req, res) => {
  const data = await hospitalService.verifiedDonations(req.user.id, req.query);
  ok(res, data, 'Verified donations');
});

export const stats = asyncHandler(async (req, res) => {
  const data = await hospitalService.stats(req.user.id);
  ok(res, data, 'Hospital analytics');
});

// Nearby compatible donors for a hospital (reuses the smart-matching engine).
export const nearbyDonors = asyncHandler(async (req, res) => {
  const donors = await donorService.searchDonors(req.query);
  ok(res, { donors, count: donors.length }, 'Nearby donors');
});

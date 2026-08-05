import * as donationService from '../services/donation.service.js';
import * as certificateService from '../services/certificate.service.js';
import { ok, asyncHandler } from '../utils/response.js';

export const history = asyncHandler(async (req, res) => {
  const data = await donationService.history(req.user.id, req.query);
  ok(res, data, 'Donation history');
});

export const getOne = asyncHandler(async (req, res) => {
  const donation = await donationService.getOne(req.user.id, req.params.id);
  ok(res, { donation }, 'Donation');
});

export const leaveFeedback = asyncHandler(async (req, res) => {
  const donation = await donationService.leaveFeedback(req.user.id, req.params.id, req.body);
  ok(res, { donation }, 'Feedback recorded');
});

export const certificate = asyncHandler(async (req, res) => {
  const data = await certificateService.getCertificateUrl(req.user.id, req.params.id);
  ok(res, data, 'Donation certificate');
});

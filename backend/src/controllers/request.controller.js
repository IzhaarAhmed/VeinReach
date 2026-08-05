import * as requestService from '../services/request.service.js';
import * as donorService from '../services/donor.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';

export const create = asyncHandler(async (req, res) => {
  const request = await requestService.createRequest(req.user.id, req.body);
  created(res, { request }, 'Blood request created');
});

export const getOne = asyncHandler(async (req, res) => {
  const request = await requestService.getRequest(req.params.id);
  ok(res, { request }, 'Request');
});

export const listActive = asyncHandler(async (req, res) => {
  const requests = await requestService.listActive();
  ok(res, { requests }, 'Active requests');
});

export const mine = asyncHandler(async (req, res) => {
  const requests = await requestService.myRequests(req.user.id);
  ok(res, { requests }, 'My requests');
});

export const accept = asyncHandler(async (req, res) => {
  const request = await requestService.acceptRequest(req.params.id, req.user.id);
  ok(res, { request }, 'Request accepted');
});

export const completeDonation = asyncHandler(async (req, res) => {
  const request = await requestService.completeDonation(
    req.params.id,
    req.user.id,
    req.params.donorId
  );
  ok(res, { request }, 'Donation confirmed');
});

export const setStatus = asyncHandler(async (req, res) => {
  const request = await requestService.updateStatus(
    req.params.id,
    req.user.id,
    req.body.status
  );
  ok(res, { request }, 'Status updated');
});

export const searchDonors = asyncHandler(async (req, res) => {
  const donors = await donorService.searchDonors(req.query);
  ok(res, { donors, count: donors.length }, 'Matching donors');
});

export const radar = asyncHandler(async (req, res) => {
  const data = await donorService.radar(req.query);
  ok(res, data, 'Donor radar');
});

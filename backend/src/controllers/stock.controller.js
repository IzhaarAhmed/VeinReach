import * as stockService from '../services/stock.service.js';
import { ok, asyncHandler } from '../utils/response.js';

export const myStock = asyncHandler(async (req, res) => {
  const stock = await stockService.getMyStock(req.user.id);
  ok(res, { stock }, 'Blood bank inventory');
});

export const upsertStock = asyncHandler(async (req, res) => {
  const stock = await stockService.upsertStock(req.user.id, req.body);
  ok(res, { stock }, 'Inventory published');
});

export const publishShortage = asyncHandler(async (req, res) => {
  const data = await stockService.publishShortage(req.user.id, req.body);
  ok(res, data, `Shortage published — ${data.alerted} donor(s) alerted`);
});

export const nearby = asyncHandler(async (req, res) => {
  const banks = await stockService.listNearby(req.query);
  ok(res, { banks, count: banks.length }, 'Nearby blood banks');
});

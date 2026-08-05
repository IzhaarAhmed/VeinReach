import * as geoService from '../services/geo.service.js';
import { ok, asyncHandler } from '../utils/response.js';

export const hospitals = asyncHandler(async (req, res) => {
  const hospitals = await geoService.searchHospitals(req.query);
  ok(res, { hospitals }, 'Hospital suggestions');
});

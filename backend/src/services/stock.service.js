import { BloodStock } from '../models/stock.model.js';
import { User } from '../models/user.model.js';
import * as donorRepo from '../repositories/donor.repository.js';
import { compatibleDonorGroups } from './compatibility.service.js';
import { notifyUser } from './notification.service.js';
import { getIO } from '../realtime/io.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/** Shortage levels that count as a shortage (vs plain availability). */
const SHORTAGE_LEVELS = ['low', 'critical', 'out'];

/** Derive a default level from unit count when the bank didn't set one. */
function deriveLevel(units, provided) {
  if (provided) return provided;
  return units > 0 ? 'available' : 'out';
}

/** The caller's inventory doc, created empty on first access. */
export async function getMyStock(ownerId) {
  let stock = await BloodStock.findOne({ owner: ownerId });
  if (!stock) {
    const bank = await User.findById(ownerId).select('fullName city state location');
    stock = await BloodStock.create({
      owner: ownerId,
      organizationName: bank?.fullName,
      address: [bank?.city, bank?.state].filter(Boolean).join(', ') || undefined,
      location: bank?.location?.coordinates?.length
        ? { type: 'Point', coordinates: bank.location.coordinates }
        : undefined,
    });
  }
  return stock.toJSON();
}

/**
 * Publish inventory: set organization details, location, and per-group units /
 * levels (merged by blood group). This is both "publish availability" and the
 * routine stock update in the spec.
 */
export async function upsertStock(ownerId, input) {
  const stock = (await BloodStock.findOne({ owner: ownerId })) || new BloodStock({ owner: ownerId });

  if (input.organizationName !== undefined) stock.organizationName = input.organizationName;
  if (input.address !== undefined) stock.address = input.address;
  if (input.location)
    stock.location = { type: 'Point', coordinates: input.location.coordinates };

  if (Array.isArray(input.inventory)) {
    const byGroup = new Map(stock.inventory.map((i) => [i.bloodGroup, i]));
    for (const item of input.inventory) {
      byGroup.set(item.bloodGroup, {
        bloodGroup: item.bloodGroup,
        units: item.units ?? 0,
        level: deriveLevel(item.units ?? 0, item.level),
        updatedAt: new Date(),
      });
    }
    stock.inventory = [...byGroup.values()];
  }

  if (!stock.location?.coordinates?.length)
    throw ApiError.badRequest('A location is required to publish stock so recipients can find you');

  stock.lastPublishedAt = new Date();
  await stock.save();
  return stock.toJSON();
}

/**
 * Publish a shortage for one blood group and broadcast an emergency alert to
 * nearby compatible donors (spec: Blood Bank — publish shortages + emergency
 * alerts). Returns how many donors were alerted.
 */
export async function publishShortage(ownerId, { bloodGroup, level = 'critical', radiusKm = 20, note }) {
  const stock = await BloodStock.findOne({ owner: ownerId });
  if (!stock) throw ApiError.badRequest('Set up your inventory before publishing a shortage');
  if (!stock.location?.coordinates?.length)
    throw ApiError.badRequest('Your blood bank has no location set');

  // Update (or insert) the group's level.
  const item = stock.inventory.find((i) => i.bloodGroup === bloodGroup);
  if (item) {
    item.level = level;
    item.updatedAt = new Date();
  } else {
    stock.inventory.push({ bloodGroup, units: 0, level, updatedAt: new Date() });
  }
  stock.lastPublishedAt = new Date();
  await stock.save();

  const alerted = await broadcastShortage(stock, { bloodGroup, level, radiusKm, note });
  return { alerted, bloodGroup, level };
}

async function broadcastShortage(stock, { bloodGroup, level, radiusKm, note }) {
  const io = getIO();
  const donors = await donorRepo.findNearbyDonors({
    coordinates: stock.location.coordinates,
    groups: compatibleDonorGroups(bloodGroup),
    maxDistanceMeters: radiusKm * 1000,
    limit: 500,
  });

  const orgName = stock.organizationName || 'A blood bank';
  let alerted = 0;
  for (const d of donors) {
    const distanceKm = Math.round(d.distanceMeters / 100) / 10;
    io?.to(`user:${d._id}`).emit('stock:shortage', {
      bloodGroup,
      level,
      organizationName: orgName,
      distanceKm,
    });
    await notifyUser(d._id, {
      type: 'system',
      title: `🩸 ${level === 'critical' ? 'CRITICAL ' : ''}${bloodGroup} shortage nearby`,
      body: `${orgName} has a ${level} shortage of ${bloodGroup} blood, ~${distanceKm} km from you.${note ? ` ${note}` : ''} Please consider donating.`,
      data: { bloodGroup, level, organizationName: orgName },
      channels: level === 'critical' ? ['inapp', 'email', 'push'] : ['inapp', 'push'],
    });
    alerted += 1;
  }
  logger.info(`blood bank ${stock.owner} shortage ${bloodGroup}/${level} alerted ${alerted} donors`);
  return alerted;
}

/**
 * Public discovery: blood banks near a point, newest publication first, with
 * distance. Optionally filter to banks that stock a given blood group, or that
 * currently have a shortage.
 */
export async function listNearby({ lng, lat, radiusKm = 25, bloodGroup, shortagesOnly }) {
  const banks = await BloodStock.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: { 'location.coordinates.0': { $exists: true } },
      },
    },
    { $limit: 100 },
  ]);

  return banks
    .map((b) => {
      let inventory = b.inventory || [];
      if (bloodGroup) inventory = inventory.filter((i) => i.bloodGroup === bloodGroup);
      if (shortagesOnly) inventory = inventory.filter((i) => SHORTAGE_LEVELS.includes(i.level));
      return {
        id: b._id,
        organizationName: b.organizationName,
        address: b.address,
        distanceKm: Math.round((b.distanceMeters / 1000) * 10) / 10,
        inventory,
        lastPublishedAt: b.lastPublishedAt,
      };
    })
    .filter((b) => !(bloodGroup || shortagesOnly) || b.inventory.length > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

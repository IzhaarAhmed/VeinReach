import { ApiError } from '../utils/ApiError.js';

// Photon (photon.komoot.io): free OpenStreetMap geocoder, no API key.
// Proxied through the API so the browser never depends on third-party
// reachability (ad-blockers, DNS), and so the provider can be swapped here
// (e.g. Google Places) without touching the frontend.
const PHOTON_URL = 'https://photon.komoot.io/api/';

// OSM tagging is inconsistent — hospitals appear under both amenity= and
// healthcare=. Multiple osm_tag params are OR'd by Photon.
const HOSPITAL_TAGS = ['amenity:hospital', 'healthcare:hospital', 'amenity:clinic'];

function formatAddress(p) {
  return [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.district,
    p.city,
    p.state,
    p.postcode,
    p.country,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Great-circle distance in km between two [lng, lat] points. */
export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// OSRM public demo server — free driving router, no API key. Fine for
// development; self-host or use a paid router at production scale.
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
// Fallback speed when the router is unreachable: conservative city driving.
const FALLBACK_SPEED_KMH = 25;

/**
 * Driving ETA between two [lng, lat] points.
 * Returns { minutes, km, estimated } — `estimated: true` means the router was
 * unreachable and we fell back to straight-line distance at city speed.
 */
export async function drivingEta(from, to) {
  try {
    const res = await fetch(
      `${OSRM_URL}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      const route = data.routes?.[0];
      if (route) {
        return {
          minutes: Math.max(1, Math.round(route.duration / 60)),
          km: Math.round((route.distance / 1000) * 10) / 10,
          estimated: false,
        };
      }
    }
  } catch {
    // fall through to the straight-line estimate
  }
  const km = haversineKm(from, to);
  return {
    minutes: Math.max(1, Math.round((km / FALLBACK_SPEED_KMH) * 60)),
    km: Math.round(km * 10) / 10,
    estimated: true,
  };
}

/**
 * Hospitals near a point (no name query — used for meetup suggestions).
 * Returns [{ id, name, address, lng, lat, distanceKm }] sorted by distance.
 */
export async function hospitalsNear({ lat, lng, limit = 5 }) {
  const params = new URLSearchParams({ q: 'hospital', limit: String(limit * 2) });
  for (const tag of HOSPITAL_TAGS) params.append('osm_tag', tag);
  params.set('lat', String(lat));
  params.set('lon', String(lng));
  // Weight proximity heavily so results cluster around the midpoint.
  params.set('location_bias_scale', '0.5');
  params.set('zoom', '14');

  let res;
  try {
    res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { 'User-Agent': 'VeinReach/0.1 (blood donation platform)' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(502, 'Hospital search service unreachable');
  }
  if (!res.ok) throw new ApiError(502, 'Hospital search service error');

  const data = await res.json();
  return (data.features || [])
    .map((f) => ({
      id: `${f.properties.osm_type}${f.properties.osm_id}`,
      name: f.properties.name,
      address: formatAddress(f.properties),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      distanceKm:
        Math.round(haversineKm([lng, lat], f.geometry.coordinates) * 10) / 10,
    }))
    .filter((h) => h.name)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/**
 * Search hospitals by free-text query, optionally biased toward a point.
 * Returns [{ id, name, address, lng, lat }].
 */
export async function searchHospitals({ q, lat, lng, limit = 6 }) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  for (const tag of HOSPITAL_TAGS) params.append('osm_tag', tag);
  if (lat != null && lng != null) {
    params.set('lat', String(lat));
    params.set('lon', String(lng));
  }

  let res;
  try {
    res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { 'User-Agent': 'VeinReach/0.1 (blood donation platform)' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(502, 'Hospital search service unreachable');
  }
  if (!res.ok) throw new ApiError(502, 'Hospital search service error');

  const data = await res.json();
  return (data.features || [])
    .map((f) => ({
      id: `${f.properties.osm_type}${f.properties.osm_id}`,
      name: f.properties.name,
      address: formatAddress(f.properties),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }))
    .filter((h) => h.name);
}

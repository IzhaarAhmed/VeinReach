import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Leaflet map for the Find Donors view.
 *
 * Privacy note: the API never returns donors' exact coordinates (spec rule).
 * We only know each donor's distance from the search point, so we plot them at
 * an APPROXIMATE position — the true distance along a deterministic pseudo-random
 * bearing derived from the donor id. This conveys proximity/density honestly
 * without revealing real locations. Markers are labelled "approx." accordingly.
 *
 * @param {object} props
 * @param {[number,number]} props.center      [lat, lng] search origin
 * @param {number} props.radiusKm             circle radius to draw
 * @param {Array}  props.donors               results (need id, distanceKm, ...)
 * @param {(latlng:{lat:number,lng:number})=>void} props.onPick  click handler
 */
export default function DonorMap({ center, radiusKm = 10, donors = [], onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null); // group holding center, circle, donor pins
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Init once.
  useEffect(() => {
    if (mapRef.current || !elRef.current) return undefined;

    const map = L.map(elRef.current, {
      center: center || [20.5937, 78.9629], // default: India centroid
      zoom: center ? 12 : 5,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(map);

    map.on('click', (e) => {
      onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Leaflet mis-measures size if the container animates in; nudge it.
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw center, radius, and donor pins whenever inputs change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !center) return;

    layer.clearLayers();
    const [lat, lng] = center;

    // Search-center marker (a glowing drop).
    const centerIcon = L.divIcon({
      className: '',
      html: `<div style="filter:drop-shadow(0 0 6px #e11d48)"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="#e11d48" stroke="#fff" stroke-width="1.5"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 24],
    });
    L.marker([lat, lng], { icon: centerIcon, zIndexOffset: 1000 })
      .addTo(layer)
      .bindPopup('Search center');

    // Radius circle.
    const circle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#ef4444',
      weight: 1.5,
      fillColor: '#dc2626',
      fillOpacity: 0.08,
    }).addTo(layer);

    // Approximate donor pins.
    donors.forEach((d, i) => {
      const pos = approxLatLng(lat, lng, d.distanceKm ?? 0, d.id || String(i));
      const color = d.eligible ? '#34d399' : '#fbbf24'; // emerald / amber
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:26px;height:26px;border-radius:50%;
          background:${color};color:#070b16;
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:800;
          border:2px solid #070b16;box-shadow:0 0 0 2px ${color}55,0 2px 6px #000a;
        ">${escapeHtml(d.bloodGroup || '')}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker(pos, { icon })
        .addTo(layer)
        .bindPopup(
          `<strong>${escapeHtml(d.fullName || 'Donor')}</strong><br/>` +
            `${escapeHtml(d.bloodGroup || '')} · ~${d.distanceKm} km away<br/>` +
            `<span style="color:#888"><svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24" style="vertical-align:-1px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg> ${d.reputationScore ?? 0} · ${d.donationCount ?? 0} donations</span><br/>` +
            `<span style="color:${color}">${d.eligible ? 'Eligible' : 'Not eligible'}</span><br/>` +
            `<em style="color:#888;font-size:11px">approx. position (privacy)</em>`
        );
    });

    // Frame everything nicely.
    map.setView([lat, lng], radiusToZoom(radiusKm));
    map.fitBounds(circle.getBounds(), { padding: [30, 30], maxZoom: 14 });
  }, [center, radiusKm, donors]);

  return (
    <div
      ref={elRef}
      className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/10"
      role="application"
      aria-label="Donor map"
    />
  );
}

/* Deterministic bearing from an id so a donor stays put across re-renders. */
function approxLatLng(lat, lng, distanceKm, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bearing = (h % 360) * (Math.PI / 180);
  const dLat = (distanceKm / 111) * Math.cos(bearing);
  const dLng =
    (distanceKm / (111 * Math.cos((lat * Math.PI) / 180) || 1)) * Math.sin(bearing);
  return [lat + dLat, lng + dLng];
}

function radiusToZoom(km) {
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  if (km <= 20) return 11;
  return 10;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

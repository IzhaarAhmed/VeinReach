import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

/** Browser geolocation as a promise, resolving to [lng, lat] (GeoJSON order). */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error('Geolocation is not supported by this browser'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      () => reject(new Error('Location access denied')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/**
 * Donor availability toggle. Going available refreshes the donor's location
 * from the browser (geo search only finds donors with coordinates); if the
 * user denies location but already has coordinates on file, we keep those.
 */
export default function AvailabilityCard() {
  const { user, refreshUser } = useAuth();
  const [error, setError] = useState('');

  const isAvailable = user?.donorProfile?.isAvailable ?? false;
  const hasLocation = (user?.location?.coordinates?.length ?? 0) === 2;

  const toggle = useMutation({
    mutationFn: async (nextAvailable) => {
      const body = { isAvailable: nextAvailable };
      if (nextAvailable) {
        try {
          body.location = { coordinates: await getPosition() };
        } catch (e) {
          if (!hasLocation)
            throw new Error(
              `${e.message}. Nearby recipients can only find you with a location.`
            );
        }
      }
      return unwrap(api.patch('/users/me/donor', body));
    },
    onSuccess: async () => {
      setError('');
      await refreshUser();
    },
    onError: (e) => setError(e.message),
  });

  if (user?.role !== 'donor') return null;

  return (
    <div
      className={`card border ${
        isAvailable ? 'border-emerald-500/40' : 'border-white/10'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isAvailable ? 'bg-emerald-400' : 'bg-white/30'
              }`}
              aria-hidden
            />
            {isAvailable ? 'You are available to donate' : 'You are offline'}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {isAvailable
              ? `Recipients searching within ${user?.donorProfile?.preferredRadiusKm ?? 10} km can find and notify you.`
              : 'Go available to appear in nearby donor searches and receive blood request alerts.'}
          </p>
        </div>
        <button
          onClick={() => toggle.mutate(!isAvailable)}
          disabled={toggle.isPending}
          className={isAvailable ? 'btn-ghost' : 'btn-primary'}
          aria-pressed={isAvailable}
        >
          {toggle.isPending
            ? 'Updating…'
            : isAvailable
              ? 'Go offline'
              : 'Go available'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-300">{error}</p>}
    </div>
  );
}

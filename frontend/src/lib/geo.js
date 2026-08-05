/** Browser geolocation as a promise, resolving to [lng, lat] (GeoJSON order). */
export function getPosition() {
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

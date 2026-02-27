// lib/gps.js — GPS acquisition: warmup, watchPosition wrapper, Haversine

export function warmupGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(() => {}, () => {}, {
    enableHighAccuracy: false,
    timeout: 2000,
    maximumAge: 60000
  });
}

export function acquirePosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available on this device'));
      return;
    }

    let bestResult = null;
    let watchId = null;
    let timeout = null;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!bestResult || accuracy < bestResult.accuracy) {
          bestResult = { lat: latitude, lng: longitude, accuracy };
        }
        // Accept when accuracy < 30m
        if (accuracy < 30) {
          cleanup();
          resolve(bestResult);
        }
      },
      (err) => {
        cleanup();
        const messages = {
          1: "Location access denied. Please enable GPS in Settings to catch spots!",
          2: "Can't find your location right now. Try moving to an open area!",
          3: "Location search timed out. GPS signal might be weak here."
        };
        reject(new Error(messages[err.code] || 'Location unavailable'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Resolve with best result after 15s
    timeout = setTimeout(() => {
      cleanup();
      if (bestResult) resolve(bestResult);
      else reject(new Error("Couldn't get a GPS lock. Try again in an open area!"));
    }, 15000);

    function cleanup() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeout) clearTimeout(timeout);
      watchId = null;
      timeout = null;
    }
  });
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function appleMapsUrl(lat, lng, name = '') {
  return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
}

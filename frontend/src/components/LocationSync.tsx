'use client';

import { useEffect } from 'react';

// Captures the browser geolocation once per session and saves it to the user's
// profile. This is what actually makes SOS work for real users: a patient needs
// a saved location to send an SOS, and donors need one to be matched by
// proximity. Renders nothing.
export default function LocationSync() {
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    if (sessionStorage.getItem('locationSynced') === '1') return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch('/api/me/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        })
          .then((res) => {
            if (res.ok) sessionStorage.setItem('locationSynced', '1');
          })
          .catch(() => {
            /* transient — will retry next load */
          });
      },
      () => {
        /* permission denied — user can still browse; SOS will prompt to enable it */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  return null;
}

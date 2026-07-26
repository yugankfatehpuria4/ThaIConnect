'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

// Self-contained SVG pin markers — no external CDN/image dependency, so they
// always render and don't violate a strict CSP (previously loaded from
// unpkg.com and raw.githubusercontent.com).
function pinIcon(color: string) {
  const svg = `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 25 13 25s13-15.75 13-25C26 5.82 20.18 0 13 0z" fill="${color}"/>
    <circle cx="13" cy="13" r="4.5" fill="#ffffff"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -34],
  });
}

const customIcon = pinIcon('#2563eb'); // donors (blue)
const redIcon = pinIcon('#dc2626');    // the current user (red)

type Donor = {
  _id: string;
  name: string;
  bloodGroup?: string;
  location?: { coordinates: [number, number] };
};

type MapProps = {
  userLocation: { lat: number; lng: number } | null;
  donors: Donor[];
};

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  // Only recenter when the target actually changes, so the user can freely pan
  // and zoom without the map snapping back on every parent re-render.
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]);
  return null;
}

export default function MapComponent({ userLocation, donors }: MapProps) {
  const defaultCenter: [number, number] = [28.6139, 77.2090]; // Delhi NCR default
  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter;

  return (
    <MapContainer center={center} zoom={userLocation ? 13 : 11} scrollWheelZoom={false} style={{ height: "100%", width: "100%", borderRadius: "12px", zIndex: 1 }}>
      <ChangeView center={center} zoom={userLocation ? 13 : 11} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={redIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {donors.map((d) => {
        if (!d.location?.coordinates) return null;
        const [lng, lat] = d.location.coordinates;
        if (!lat || !lng) return null;
        return (
          <Marker key={d._id} position={[lat, lng]} icon={customIcon}>
            <Popup>
              <strong>{d.name}</strong><br/>
              Blood Group: {d.bloodGroup || 'N/A'}<br/>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

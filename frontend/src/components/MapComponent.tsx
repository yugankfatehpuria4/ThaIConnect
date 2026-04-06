'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

// Fix typical React-Leaflet icon issue with marker URLs
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
  map.setView(center, zoom);
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

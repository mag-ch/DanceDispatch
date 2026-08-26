'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useCallback, useEffect } from 'react';
import { MapPartyEvent } from './PartyMapClient';


// Bundlers break Leaflet's default marker icon URLs; point them at the CDN assets instead.
const userLocationIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33],
  className: 'hue-rotate-180',
});

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

type UserLocation = { lat: number; lng: number };

function FitToEvents({ events, userLocation }: { events: MapPartyEvent[]; userLocation: UserLocation | null }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = events.map((event) => [event.lat, event.lng]);
    if (userLocation) {
      points.push([userLocation.lat, userLocation.lng]);
    }

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

  map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [events, userLocation, map]);

  return null;
}

// Zooms/pans to the selected event whenever the selection changes.
function FlyToSelectedEvent({ events, selectedEventId }: { events: MapPartyEvent[]; selectedEventId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    const selectedEvent = events.find((event) => event.id === selectedEventId);
    if (!selectedEvent) {
      return;
    }

    map.flyTo([selectedEvent.lat, selectedEvent.lng], 16, { duration: 0.75 });
  }, [selectedEventId, events, map]);

  return null;
}

export type MapBoundsBox = { north: number; south: number; east: number; west: number };

// Reports the current viewport whenever the user pans or zooms, so the list can follow along.
function MapBoundsWatcher({ onBoundsChange }: { onBoundsChange?: (bounds: MapBoundsBox) => void }) {
  const map = useMap();

  const emitBounds = useCallback(() => {
    if (!onBoundsChange) return;
    const bounds = map.getBounds();
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: emitBounds,
    zoomend: emitBounds,
  });

  useEffect(() => {
    emitBounds();
  }, [emitBounds]);

  return null;
}

// Fades markers out the farther their event date is from today (in either direction).
const MAX_FADE_DAYS = 30;
const MIN_MARKER_OPACITY = 0.35;

function opacityForEventDate(event: MapPartyEvent): number {
  const start = new Date(`${event.startdate}T${event.starttime || '00:00'}`);
  const daysFromToday = Math.abs(start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const clampedDays = Math.min(daysFromToday, MAX_FADE_DAYS);
  return 1 - (clampedDays / MAX_FADE_DAYS) * (1 - MIN_MARKER_OPACITY);
}

const PIN_SIZE = 40;
const SELECTED_PIN_SIZE = 56;

// Renders the pin as a circular thumbnail of the event's own image instead of a generic marker.
function createEventPinIcon(event: MapPartyEvent, isSelected: boolean): L.DivIcon {
  const size = isSelected ? SELECTED_PIN_SIZE : PIN_SIZE;
  const imageUrl = (event.imageurl || '/images/default_events.jpg').replace(/'/g, '%27');

  return L.divIcon({
    html: `<div class="dd-party-pin-photo" style="background-image:url('${imageUrl}')"></div>`,
    className: `dd-party-pin${isSelected ? ' dd-party-pin-selected' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function PartyMapView({
  events,
  userLocation,
  selectedEventId = null,
  onSelectEvent,
  onBoundsChange,
}: {
  events: MapPartyEvent[];
  userLocation?: UserLocation | null;
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
  onBoundsChange?: (bounds: MapBoundsBox) => void;
}) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      scrollWheelZoom
      style={{ height: '600px', width: '100%' }}
      className="dd-party-map z-0 rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToEvents events={events} userLocation={userLocation ?? null} />
      <FlyToSelectedEvent events={events} selectedEventId={selectedEventId} />
      <MapBoundsWatcher onBoundsChange={onBoundsChange} />
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {events.map((event) => (
        <Marker
          key={event.id + "-mapview"}
          position={[event.lat, event.lng]}
          icon={createEventPinIcon(event, event.id === selectedEventId)}
          opacity={opacityForEventDate(event)}
          eventHandlers={{ click: () => onSelectEvent?.(event.id) }}
        />
      ))}
    </MapContainer>
  );
}

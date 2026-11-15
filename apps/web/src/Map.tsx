import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed } from 'lucide-react';
import type { Location } from '@qsale/contracts';
import { Button, Field } from './ui';

export interface MapPoint {
  latitude: number;
  longitude: number;
  label: string;
  midpoint?: boolean;
}
export function MapView({
  points,
  onSelect,
  initial,
}: {
  points: MapPoint[];
  onSelect?: (location: Location) => void;
  initial?: Location | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!element.current) return;
    const center = initial ?? points[0] ?? { latitude: -12.115, longitude: -77.025 };
    map.current = L.map(element.current, { scrollWheelZoom: false }).setView(
      [center.latitude, center.longitude],
      12,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    map.current.on('click', (event: L.LeafletMouseEvent) =>
      select.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
    );
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    markers.current?.clearLayers();
    const displayed = [...points, ...(initial ? [{ ...initial, label: 'Ubicación elegida' }] : [])];
    displayed.forEach((point) => {
      const text = document.createElement('span');
      text.textContent = point.label;
      L.circleMarker([point.latitude, point.longitude], {
        radius: 9,
        color: point.midpoint ? '#16644a' : '#C64B08',
        fillColor: point.midpoint ? '#47b88b' : '#FF8224',
        fillOpacity: 1,
        weight: 2,
      })
        .bindPopup(text)
        .addTo(markers.current!);
    });
    if (displayed.length && map.current)
      map.current.fitBounds(L.latLngBounds(displayed.map((p) => [p.latitude, p.longitude])), {
        padding: [40, 40],
        maxZoom: 14,
      });
  }, [points, initial]);
  return (
    <div
      className="map"
      ref={element}
      aria-label={
        onSelect
          ? 'Mapa para elegir ubicación. También puedes usar los campos de coordenadas.'
          : 'Mapa de lugares propuestos y punto medio'
      }
      role="region"
    />
  );
}
export function LocationPicker({
  value,
  onChange,
  onValidityChange,
}: {
  value: Location | null;
  onChange: (value: Location | null) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  const [address, setAddress] = useState(value?.address ?? '');
  const complete = (latitude: string, longitude: string, address: string) => {
    const valid =
      latitude.trim() !== '' &&
      longitude.trim() !== '' &&
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude)) &&
      Math.abs(Number(latitude)) <= 90 &&
      Math.abs(Number(longitude)) <= 180;
    onChange(valid ? { latitude: Number(latitude), longitude: Number(longitude), address } : null);
    onValidityChange?.(valid || (!latitude && !longitude && !address));
  };
  const select = (point: Location) => {
    setLatitude(String(point.latitude));
    setLongitude(String(point.longitude));
    setAddress(point.address ?? '');
    onChange(point);
    onValidityChange?.(true);
  };
  return (
    <div className="location-picker">
      <div className="location-toolbar">
        <span>
          <MapPin size={18} />
          {value ? 'Ubicación elegida' : 'Elige un punto en el mapa'}
        </span>
        <Button
          type="button"
          variant="secondary"
          busy={busy}
          onClick={() => {
            setError('');
            if (!navigator.geolocation) {
              setError(
                'Este navegador no ofrece ubicación. Elige un punto en el mapa o ingresa sus coordenadas.',
              );
              return;
            }
            setBusy(true);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                select({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                });
                setBusy(false);
              },
              () => {
                setBusy(false);
                setError(
                  'No pudimos acceder a tu ubicación. Revisa el permiso o elige un punto manualmente.',
                );
              },
              { timeout: 12000, maximumAge: 60000 },
            );
          }}
        >
          <LocateFixed size={17} />
          Usar mi ubicación
        </Button>
      </div>
      <MapView points={[]} initial={value} onSelect={select} />
      <div className="form-row">
        <Field
          label="Latitud"
          type="number"
          step="any"
          min={-90}
          max={90}
          value={latitude}
          onChange={(event) => {
            setLatitude(event.target.value);
            complete(event.target.value, longitude, address);
          }}
        />
        <Field
          label="Longitud"
          type="number"
          step="any"
          min={-180}
          max={180}
          value={longitude}
          onChange={(event) => {
            setLongitude(event.target.value);
            complete(latitude, event.target.value, address);
          }}
        />
      </div>
      <Field
        label="Dirección o referencia (opcional)"
        maxLength={255}
        value={address}
        onChange={(event) => {
          setAddress(event.target.value);
          complete(latitude, longitude, event.target.value);
        }}
      />
      {!value && (latitude || longitude || address) && (
        <p className="field-error">
          Selecciona un punto o completa ambas coordenadas válidas para guardar la ubicación.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-hint">
        El mapa usa OpenStreetMap y necesita conexión. También puedes ingresar las coordenadas.
      </p>
    </div>
  );
}

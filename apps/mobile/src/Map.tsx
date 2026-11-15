import { useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as DeviceLocation from 'expo-location';
import type { Location } from '@qsale/contracts';
import { Button, Field, Text, styles } from './ui';

export interface MapPoint {
  latitude: number;
  longitude: number;
  label: string;
  midpoint?: boolean;
}
export function MapView({
  points,
  value,
  onChange,
}: {
  points: MapPoint[];
  value?: Location | null;
  onChange?: (location: Location) => void;
}) {
  const [error, setError] = useState(false);
  const html = useMemo(() => {
    const serialized = JSON.stringify([
      ...points,
      ...(value ? [{ ...value, label: 'Ubicación elegida' }] : []),
    ]).replaceAll('<', '\\u003c');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0}body{background:#eeece6;font-family:sans-serif}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const points=${serialized};const map=L.map('map',{scrollWheelZoom:false}).setView([-12.115,-77.025],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);points.forEach(p=>{const text=document.createElement('span');text.textContent=p.label;L.circleMarker([p.latitude,p.longitude],{radius:8,color:p.midpoint?'#16644a':'#C64B08',fillOpacity:1}).bindPopup(text).addTo(map)});if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[35,35],maxZoom:14});${onChange ? "map.on('click',e=>window.ReactNativeWebView.postMessage(JSON.stringify({latitude:e.latlng.lat,longitude:e.latlng.lng})))" : ''}</script></body></html>`;
  }, [JSON.stringify(points), JSON.stringify(value), Boolean(onChange)]);
  if (Platform.OS === 'web')
    return (
      <View style={styles.note}>
        <Text style={styles.muted}>
          En el teléfono puedes explorar el mapa dentro de QSale. En esta vista previa usa las
          coordenadas o abre OpenStreetMap.
        </Text>
        <Button
          variant="quiet"
          onPress={() =>
            void Linking.openURL(
              'https://www.openstreetmap.org/?mlat=' +
                (value?.latitude ?? points[0]?.latitude ?? -12.115) +
                '&mlon=' +
                (value?.longitude ?? points[0]?.longitude ?? -77.025) +
                '#map=13/' +
                (value?.latitude ?? -12.115) +
                '/' +
                (value?.longitude ?? -77.025),
            )
          }
        >
          Abrir OpenStreetMap
        </Button>
      </View>
    );
  return (
    <View>
      {error ? (
        <Text style={styles.error}>
          No pudimos cargar el mapa. Revisa tu conexión o usa las coordenadas.
        </Text>
      ) : (
        <View style={styles.map}>
          <WebView
            originWhitelist={['https://qsale.local', 'about:blank']}
            source={{ html, baseUrl: 'https://qsale.local' }}
            onShouldStartLoadWithRequest={(request) =>
              request.url === 'about:blank' || request.url.startsWith('https://qsale.local')
            }
            onError={() => setError(true)}
            onMessage={(event) => {
              try {
                const point = JSON.parse(event.nativeEvent.data);
                if (
                  typeof point.latitude === 'number' &&
                  Math.abs(point.latitude) <= 90 &&
                  typeof point.longitude === 'number' &&
                  Math.abs(point.longitude) <= 180
                )
                  onChange?.(point);
              } catch {}
            }}
            javaScriptEnabled
            domStorageEnabled={false}
            allowsInlineMediaPlayback={false}
            mixedContentMode="never"
          />
        </View>
      )}
      <Text style={styles.muted}>Mapa © OpenStreetMap · necesita conexión.</Text>
    </View>
  );
}
export function LocationPicker({
  value,
  onChange,
  onValidityChange,
}: {
  value: Location | null;
  onChange: (location: Location | null) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : ''),
    [longitude, setLongitude] = useState(value ? String(value.longitude) : ''),
    [address, setAddress] = useState(value?.address ?? '');
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
    <View style={{ gap: 15 }}>
      <Button
        variant="secondary"
        icon="crosshair"
        busy={busy}
        onPress={async () => {
          setError('');
          setBusy(true);
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const permission = await DeviceLocation.requestForegroundPermissionsAsync();
            if (!permission.granted) {
              setError(
                'No se concedió el permiso de ubicación. Puedes elegir el punto o ingresar sus coordenadas.',
              );
              return;
            }
            const position = await Promise.race([
              DeviceLocation.getCurrentPositionAsync({
                accuracy: DeviceLocation.Accuracy.Balanced,
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), 15000);
              }),
            ]);
            select({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          } catch {
            setError(
              'No pudimos obtener tu ubicación. Revisa el GPS o ingresa el punto manualmente.',
            );
          } finally {
            if (timer) clearTimeout(timer);
            setBusy(false);
          }
        }}
      >
        Usar mi ubicación
      </Button>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <MapView points={[]} value={value} onChange={select} />
      {value && (
        <Button
          variant="quiet"
          onPress={() => {
            setLatitude('');
            setLongitude('');
            setAddress('');
            onChange(null);
            onValidityChange?.(true);
          }}
        >
          Quitar ubicación
        </Button>
      )}
      <Field
        label="Latitud"
        keyboardType="numbers-and-punctuation"
        value={latitude}
        onChangeText={(text) => {
          setLatitude(text);
          complete(text, longitude, address);
        }}
      />
      <Field
        label="Longitud"
        keyboardType="numbers-and-punctuation"
        value={longitude}
        onChangeText={(text) => {
          setLongitude(text);
          complete(latitude, text, address);
        }}
      />
      <Field
        label="Dirección o referencia (opcional)"
        maxLength={255}
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          complete(latitude, longitude, text);
        }}
      />
      {!value && (latitude || longitude || address) ? (
        <Text style={styles.error}>
          Selecciona un punto o completa ambas coordenadas válidas para guardar la ubicación.
        </Text>
      ) : null}
    </View>
  );
}

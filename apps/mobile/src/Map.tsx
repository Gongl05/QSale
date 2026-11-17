import { useMemo, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as DeviceLocation from 'expo-location';
import type { Location } from '@qsale/contracts';
import { Button, Field, Text, styles } from './ui';
import { buildMapDocument } from './map-document';

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
  const html = useMemo(
    () => buildMapDocument(points, value, Boolean(onChange)),
    [JSON.stringify(points), JSON.stringify(value), Boolean(onChange)],
  );
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
        <View style={styles.note}>
          <Text accessibilityRole="alert" style={styles.error}>
            No pudimos cargar el mapa. Revisa tu conexión; igual puedes buscar la dirección.
          </Text>
          <Button variant="secondary" onPress={() => setError(false)}>
            Reintentar mapa
          </Button>
        </View>
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
                if (point.error === 'map-load') {
                  setError(true);
                  return;
                }
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

type Coordinates = Pick<Location, 'latitude' | 'longitude'>;

/** Short, readable address for a reverse-geocoded point, e.g. "Av. Larco 345, Miraflores". */
function describePlace(place: DeviceLocation.LocationGeocodedAddress) {
  const street = place.street
    ? [place.street, place.streetNumber].filter(Boolean).join(' ')
    : place.name;
  const parts = [street, place.district, place.city].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.join(', ').slice(0, 255);
}

/** Android only lets the app geocode after the location permission was granted. */
async function canGeocode(ask: boolean) {
  if (Platform.OS !== 'android') return true;
  const permission = ask
    ? await DeviceLocation.requestForegroundPermissionsAsync()
    : await DeviceLocation.getForegroundPermissionsAsync();
  return permission.granted;
}

/** Opens the place in the phone's maps app (or the browser) so the group can see where it is. */
export function openInMaps(location: Location, label?: string) {
  const query = location.latitude + ',' + location.longitude;
  const url =
    Platform.OS === 'ios'
      ? 'https://maps.apple.com/?ll=' + query + '&q=' + encodeURIComponent(label || query)
      : 'https://www.google.com/maps/search/?api=1&query=' + query;
  void Linking.openURL(url);
}

export function LocationPicker({
  value,
  onChange,
  onValidityChange,
  label = 'Dirección o nombre del lugar',
  placeholder = 'Ej. Av. Larco 345, Miraflores',
}: {
  value: Location | null;
  onChange: (location: Location | null) => void;
  onValidityChange?: (valid: boolean) => void;
  label?: string;
  placeholder?: string;
}) {
  const web = Platform.OS === 'web';
  const [busy, setBusy] = useState<'' | 'gps' | 'search'>(''),
    [error, setError] = useState('');
  const [address, setAddress] = useState(value?.address ?? '');
  // Coordinates are only typed by hand in the web preview, where there is no map or geocoder.
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : ''),
    [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  // Ignores a slow reverse-geocoding answer when the user already picked another point.
  const lastPick = useRef(0);

  const select = (point: Coordinates, text: string) => {
    setLatitude(String(point.latitude));
    setLongitude(String(point.longitude));
    setAddress(text);
    onChange({ latitude: point.latitude, longitude: point.longitude, address: text.trim() || null });
    onValidityChange?.(true);
  };

  // Map taps and "usar mi ubicación": mark the point, then fill in its street address.
  const pick = async (point: Coordinates, askPermission: boolean) => {
    setError('');
    const pickId = ++lastPick.current;
    select(point, address);
    if (web) return;
    try {
      if (!(await canGeocode(askPermission))) return;
      const [place] = await DeviceLocation.reverseGeocodeAsync(point);
      const text = place ? describePlace(place) : '';
      if (text && pickId === lastPick.current) select(point, text);
    } catch {
      // The point is already marked; the user can still type the address.
    }
  };

  const search = async () => {
    const text = address.trim();
    setError('');
    if (text.length < 3) {
      setError('Escribe la dirección o el nombre del lugar.');
      return;
    }
    setBusy('search');
    try {
      if (!(await canGeocode(true))) {
        setError(
          'Para buscar direcciones, Android necesita el permiso de ubicación. También puedes tocar el lugar en el mapa.',
        );
        return;
      }
      const results = await DeviceLocation.geocodeAsync(
        /per[uú]/i.test(text) ? text : text + ', Perú',
      );
      if (!results.length) {
        setError('No encontramos ese lugar. Prueba con calle y distrito, o tócalo en el mapa.');
        return;
      }
      lastPick.current++;
      select(results[0], text);
    } catch {
      setError('No pudimos buscar la dirección. Revisa tu conexión o toca el lugar en el mapa.');
    } finally {
      setBusy('');
    }
  };

  const changeAddress = (text: string) => {
    setAddress(text);
    if (value) onChange({ ...value, address: text.trim() || null });
    onValidityChange?.(Boolean(value) || !text.trim());
  };

  const changeCoordinates = (latitude: string, longitude: string) => {
    setLatitude(latitude);
    setLongitude(longitude);
    const valid =
      latitude.trim() !== '' &&
      longitude.trim() !== '' &&
      Math.abs(Number(latitude)) <= 90 &&
      Math.abs(Number(longitude)) <= 180;
    onChange(
      valid
        ? {
            latitude: Number(latitude),
            longitude: Number(longitude),
            address: address.trim() || null,
          }
        : null,
    );
    onValidityChange?.(valid || (!latitude && !longitude && !address));
  };

  return (
    <View style={{ gap: 15 }}>
      <Field
        label={label}
        placeholder={placeholder}
        maxLength={255}
        value={address}
        onChangeText={changeAddress}
        returnKeyType={web ? 'done' : 'search'}
        onSubmitEditing={() => {
          if (!web) void search();
        }}
      />
      {!web && (
        <Button
          variant="secondary"
          icon="search"
          busy={busy === 'search'}
          disabled={Boolean(busy)}
          onPress={() => void search()}
        >
          Buscar en el mapa
        </Button>
      )}
      <Button
        variant="quiet"
        icon="crosshair"
        busy={busy === 'gps'}
        disabled={Boolean(busy)}
        onPress={async () => {
          setError('');
          setBusy('gps');
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const permission = await DeviceLocation.requestForegroundPermissionsAsync();
            if (!permission.granted) {
              setError(
                'No se concedió el permiso de ubicación. Puedes buscar la dirección o tocar el lugar en el mapa.',
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
            await pick(position.coords, false);
          } catch {
            setError(
              'No pudimos obtener tu ubicación. Revisa el GPS o busca la dirección manualmente.',
            );
          } finally {
            if (timer) clearTimeout(timer);
            setBusy('');
          }
        }}
      >
        Usar mi ubicación actual
      </Button>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <MapView points={[]} value={value} onChange={(point) => void pick(point, false)} />
      {!web && (
        <Text style={styles.muted}>
          {value
            ? 'Punto marcado. Si no es exacto, toca el lugar correcto en el mapa.'
            : 'Busca la dirección o toca el lugar en el mapa para marcarlo.'}
        </Text>
      )}
      {web && (
        <>
          <Field
            label="Latitud"
            keyboardType="numbers-and-punctuation"
            value={latitude}
            onChangeText={(text) => changeCoordinates(text, longitude)}
          />
          <Field
            label="Longitud"
            keyboardType="numbers-and-punctuation"
            value={longitude}
            onChangeText={(text) => changeCoordinates(latitude, text)}
          />
        </>
      )}
      {value && (
        <Button
          variant="quiet"
          onPress={() => {
            lastPick.current++;
            setLatitude('');
            setLongitude('');
            setAddress('');
            setError('');
            onChange(null);
            onValidityChange?.(true);
          }}
        >
          Quitar ubicación
        </Button>
      )}
      {!value && address.trim() ? (
        <Text style={styles.error}>
          {web
            ? 'Completa ambas coordenadas válidas para guardar la ubicación.'
            : 'Toca «Buscar en el mapa» o marca el lugar en el mapa para guardarlo.'}
        </Text>
      ) : null}
    </View>
  );
}

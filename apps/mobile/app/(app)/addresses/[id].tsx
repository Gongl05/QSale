import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addressSchema,
  addressTypeLabels,
  type AddressType,
  type Location,
} from '@qsale/contracts';
import { api, useSession } from '../../../src/session';
import { LocationPicker } from '../../../src/Map';
import {
  Button,
  ErrorState,
  Field,
  Loading,
  Screen,
  Tabs,
  Text,
  colors,
  confirmAction,
  styles,
  useToast,
} from '../../../src/ui';

const types = Object.entries(addressTypeLabels) as [AddressType, string][];

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.between}>
      <View style={{ flex: 1 }}>
        <Text style={styles.subheading}>{label}</Text>
        <Text style={styles.muted}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent }}
      />
    </View>
  );
}

export default function AddressEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const creating = id === 'new';
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useToast();
  const { updateUser } = useSession();
  const query = useQuery({ queryKey: ['addresses'], queryFn: ({ signal }) => api.addresses(signal) });
  const existing = creating ? undefined : query.data?.find((item) => item.id === Number(id));
  const [label, setLabel] = useState(creating ? 'Casa' : ''),
    [type, setType] = useState<AddressType>('HOME'),
    [favorite, setFavorite] = useState(true),
    [main, setMain] = useState(false),
    [location, setLocation] = useState<Location | null>(null),
    [loaded, setLoaded] = useState(creating),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');

  useEffect(() => {
    if (existing && !loaded) {
      setLabel(existing.label);
      setType(existing.type);
      setFavorite(existing.favorite);
      setMain(existing.main);
      setLocation(existing.location);
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (!creating && query.isPending) return <Loading />;
  if (!creating && (query.isError || !existing))
    return (
      <Screen>
        <ErrorState
          error={query.error ?? new Error('Esta dirección ya no existe.')}
          retry={() => void query.refetch()}
        />
      </Screen>
    );
  if (!loaded) return <Loading />;

  const first = creating && !query.data?.length;
  const labelError = label.trim() ? undefined : 'Ponle un nombre, como Casa u Oficina.';
  const save = async () => {
    const input = { label: label.trim(), type, favorite, main: main || first, location };
    const parsed = addressSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos de la dirección.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (creating) await api.createAddress(parsed.data);
      else await api.updateAddress(existing!.id, parsed.data);
      // The main address is also the profile's reference location.
      updateUser(await api.me());
      await cache.invalidateQueries();
      toast(creating ? 'Dirección guardada.' : 'Dirección actualizada.');
      router.back();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.surface}>
        <Text style={styles.label}>Tipo</Text>
        <Tabs
          items={types}
          value={type}
          onChange={(next) => {
            // Suggest the type as the name until the person writes their own.
            if (!label.trim() || types.some(([, text]) => text === label.trim()))
              setLabel(next === 'OTHER' ? '' : addressTypeLabels[next]);
            setType(next);
          }}
        />
        <Field
          label="Nombre"
          placeholder="Casa, Oficina, Casa de mis papás…"
          value={label}
          onChangeText={setLabel}
          maxLength={40}
          error={loaded && label !== '' ? labelError : undefined}
        />
        <LocationPicker value={location} onChange={setLocation} />
        <Toggle
          label="Destacada"
          hint="Aparece primero cuando eliges desde dónde sales en un plan."
          value={favorite}
          onChange={setFavorite}
        />
        <Toggle
          label="Dirección principal"
          hint={
            existing?.main
              ? 'Es tu punto de partida por defecto. Para cambiarlo, marca otra dirección como principal.'
              : first
                ? 'Tu primera dirección será la principal.'
                : 'Se usa por defecto en tus planes, salvo que elijas otra en un plan.'
          }
          value={main || first}
          onChange={setMain}
          disabled={first || existing?.main}
        />
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button busy={busy} onPress={() => void save()}>
          {creating ? 'Guardar dirección' : 'Guardar cambios'}
        </Button>
        {!creating && (
          <Button
            variant="quiet"
            icon="trash-2"
            disabled={busy}
            onPress={() =>
              confirmAction(
                '¿Eliminar esta dirección?',
                existing!.main
                  ? 'Otra de tus direcciones pasará a ser la principal. Los planes que la usaban volverán a tu dirección principal.'
                  : 'Los planes que la usaban volverán a tu dirección principal.',
                () =>
                  void api
                    .deleteAddress(existing!.id)
                    .then(async () => {
                      updateUser(await api.me());
                      await cache.invalidateQueries();
                      toast('Dirección eliminada.');
                      router.back();
                    })
                    .catch((failure) => setError((failure as Error).message)),
              )
            }
          >
            Eliminar dirección
          </Button>
        )}
      </View>
    </Screen>
  );
}

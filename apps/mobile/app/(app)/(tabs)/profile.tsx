import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { locationSchema, type Location } from '@qsale/contracts';
import { api, useSession } from '../../../src/session';
import { LocationPicker } from '../../../src/Map';
import { Button, Field, Heading, Screen, Text, styles, useToast } from '../../../src/ui';
export default function Profile() {
  const { user, updateUser, signOut } = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user!.name),
    [location, setLocation] = useState<Location | null>(user!.location),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [locationValid, setLocationValid] = useState(true);
  return (
    <Screen>
      <Heading
        title="Tu punto de partida"
        description="Tu ubicación ayuda a encontrar un lugar más conveniente para el grupo."
      />
      <View style={styles.surface}>
        <Field
          label="Nombre"
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoComplete="name"
        />
        <Field label="Correo electrónico" value={user!.email} editable={false} />
        <Text style={styles.heading}>Ubicación de referencia</Text>
        <Text style={styles.subtitle}>
          Usa un punto cercano, como una avenida o tu distrito. No necesitas compartir tu casa. El
          grupo verá el punto medio y las estimaciones agregadas.
        </Text>
        <LocationPicker
          value={location}
          onChange={setLocation}
          onValidityChange={setLocationValid}
        />
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          busy={busy}
          disabled={!locationValid}
          onPress={async () => {
            setError('');
            if (name.trim().length < 2 || name.trim().length > 100) {
              setError('Tu nombre necesita entre 2 y 100 caracteres.');
              return;
            }
            if (location && !locationSchema.safeParse(location).success) {
              setError('Revisa la latitud y longitud.');
              return;
            }
            setBusy(true);
            try {
              const updated = await api.updateMe({
                name: name.trim(),
                ...(location ? { location } : {}),
              });
              updateUser(updated);
              await cache.invalidateQueries();
              toast('Tu perfil está actualizado.');
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar mi perfil
        </Button>
      </View>
      {user!.role === 'ADMIN' && (
        <Button variant="secondary" icon="shield" onPress={() => router.push('/admin')}>
          Administración
        </Button>
      )}
      <Button
        variant="quiet"
        icon="log-out"
        onPress={() => void signOut().catch((error) => toast(error.message, true))}
      >
        Cerrar sesión
      </Button>
    </Screen>
  );
}

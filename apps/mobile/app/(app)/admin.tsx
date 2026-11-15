import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@qsale/api-client';
import type { User } from '@qsale/contracts';
import { api, useSession } from '../../src/session';
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Loading,
  Screen,
  Text,
  confirmAction,
  styles,
  useAction,
} from '../../src/ui';
export default function Admin() {
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: ({ signal }) => api.users(signal),
    enabled: user?.role === 'ADMIN',
  });
  const change = useAction(
    (target: User) => api.updateRole(target.id, target.role === 'ADMIN' ? 'USER' : 'ADMIN'),
    'Rol actualizado.',
  );
  if (user?.role !== 'ADMIN')
    return (
      <Screen>
        <ErrorState
          error={new ApiError('Solo los administradores pueden ver esta pantalla.', 403)}
        />
      </Screen>
    );
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Heading
        title="Administración"
        description="Un administrador puede gestionar todos los planes. Cambia los accesos con cuidado."
      />
      <Field label="Buscar usuario" value={search} onChangeText={setSearch} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data
          .filter((item) =>
            (item.name + ' ' + item.email).toLowerCase().includes(search.toLowerCase()),
          )
          .map((item) => (
            <View key={item.id} style={styles.surface}>
              <Text style={styles.subheading}>{item.name}</Text>
              <Text style={styles.muted}>{item.email}</Text>
              <Text>{item.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</Text>
              <Button
                variant="secondary"
                busy={change.isPending && change.variables?.id === item.id}
                disabled={change.isPending}
                onPress={() =>
                  confirmAction(
                    '¿Cambiar este acceso?',
                    `${item.name} pasará a ser ${item.role === 'ADMIN' ? 'usuario' : 'administrador'}. Este cambio afecta sus permisos inmediatamente.`,
                    () => change.mutate(item),
                  )
                }
              >
                {item.role === 'ADMIN' ? 'Cambiar a usuario' : 'Hacer administrador'}
              </Button>
            </View>
          ))
      )}
    </Screen>
  );
}

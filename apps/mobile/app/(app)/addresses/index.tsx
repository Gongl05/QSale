import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { addressTypeLabels, type SavedAddress } from '@qsale/contracts';
import { addressIcons } from '../../../src/addressIcons';
import { api } from '../../../src/session';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Screen,
  Text,
  colors,
  styles,
} from '../../../src/ui';

function AddressRow({ address, onPress }: { address: SavedAddress; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Editar ' + address.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        address.main && { borderColor: colors.ink, borderWidth: 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.between}>
        <View style={[styles.statRow, { flex: 1, gap: 12 }]}>
          <Feather name={addressIcons[address.type]} size={20} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.subheading}>{address.label}</Text>
            <Text style={styles.muted} numberOfLines={2}>
              {address.location.address || 'Punto marcado en el mapa'}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.muted} />
      </View>
      {(address.main || address.favorite) && (
        <View style={styles.row}>
          {address.main && <Badge good>Principal</Badge>}
          {address.favorite && <Badge>Destacada</Badge>}
        </View>
      )}
    </Pressable>
  );
}

export default function Addresses() {
  const router = useRouter();
  const query = useQuery({ queryKey: ['addresses'], queryFn: ({ signal }) => api.addresses(signal) });
  const open = (id: number | 'new') =>
    router.push(('/addresses/' + id) as '/addresses/[id]');
  const favorites = query.data?.filter((address) => address.favorite) ?? [];
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Heading
        title="Mis direcciones"
        description="Guarda desde dónde sueles salir. La principal se usa por defecto; en cada plan puedes elegir otra."
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <>
          {favorites.length > 0 && (
            <>
              <Text style={styles.heading}>Destacadas</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {favorites.map((address) => (
                  <Pressable
                    key={address.id}
                    accessibilityRole="button"
                    accessibilityLabel={'Editar ' + address.label}
                    onPress={() => open(address.id)}
                    style={[styles.option, { width: 180, gap: 4, padding: 14 }]}
                  >
                    <View style={styles.statRow}>
                      <Feather name={addressIcons[address.type]} size={16} color={colors.ink} />
                      <Text style={styles.subheading} numberOfLines={1}>
                        {address.label}
                      </Text>
                    </View>
                    <Text style={styles.muted} numberOfLines={1}>
                      {address.location.address || addressTypeLabels[address.type]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.heading}>Direcciones guardadas</Text>
          {query.data.map((address) => (
            <AddressRow key={address.id} address={address} onPress={() => open(address.id)} />
          ))}
        </>
      ) : (
        <EmptyState title="Aún no tienes direcciones">
          Agrega tu casa, tu oficina o el lugar desde donde sueles salir.
        </EmptyState>
      )}
      <Button icon="plus" onPress={() => open('new')}>
        Agregar nueva dirección
      </Button>
    </Screen>
  );
}

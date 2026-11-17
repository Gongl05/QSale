import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import type { PlanDetail } from '@qsale/contracts';
import { api } from './session';
import { addressIcons } from './addressIcons';
import { Button, Text, colors, styles, useAction } from './ui';

/**
 * Lets a participant say where they start from for this plan (home, office...), so travel
 * times and the midpoint use that place. Picking the main address follows it if it changes.
 */
export function OriginPicker({ plan }: { plan: PlanDetail }) {
  const router = useRouter();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: ({ signal }) => api.addresses(signal) });
  const choose = useAction(
    (addressId: number | null) => api.chooseOrigin(plan.id, addressId),
    'Listo. Recalculamos los tiempos de viaje desde ahí.',
  );
  if (plan.currentUserParticipationStatus !== 'JOINED') return null;
  const list = [...(addresses.data ?? [])].sort(
    (a, b) => Number(b.main) - Number(a.main) || Number(b.favorite) - Number(a.favorite),
  );
  const current =
    list.find((address) => address.id === plan.currentUserOriginAddressId) ??
    list.find((address) => address.main);
  return (
    <View style={styles.surface}>
      <Text style={styles.heading}>¿Desde dónde sales para este plan?</Text>
      <Text style={styles.subtitle}>
        Los tiempos de viaje y el punto medio usan este lugar. Solo afecta a este plan.
      </Text>
      {addresses.isPending ? null : list.length ? (
        <View style={{ gap: 8 }}>
          {list.map((address) => {
            const active = current?.id === address.id;
            return (
              <Pressable
                key={address.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: choose.isPending }}
                accessibilityLabel={address.label}
                disabled={choose.isPending}
                onPress={() => choose.mutate(address.main ? null : address.id)}
                style={[
                  styles.option,
                  { padding: 14, gap: 4 },
                  active && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <View style={styles.statRow}>
                  <Feather
                    name={addressIcons[address.type]}
                    size={16}
                    color={active ? colors.accent : colors.ink}
                  />
                  <Text style={[styles.subheading, { flex: 1 }]}>
                    {address.label + (address.main ? ' · principal' : '')}
                  </Text>
                  {active && <Feather name="check-circle" size={18} color={colors.accent} />}
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {address.location.address || 'Punto marcado en el mapa'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text>Aún no guardas direcciones. Agrega tu casa u oficina para calcular tus tiempos.</Text>
      )}
      <Button variant="quiet" icon="plus" onPress={() => router.push('/addresses/new')}>
        Agregar otra dirección
      </Button>
    </View>
  );
}

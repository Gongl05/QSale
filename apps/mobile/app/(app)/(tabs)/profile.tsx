import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { addressTypeLabels, displayName } from '@qsale/contracts';
import { api, useSession } from '../../../src/session';
import { Avatar } from '../../../src/Avatar';
import { Button, Screen, Text, colors, styles, useToast } from '../../../src/ui';

function MenuRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.between,
        { paddingVertical: 14, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.statRow, { flex: 1, gap: 14 }]}>
        <Feather name={icon} size={20} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.subheading}>{title}</Text>
          {detail ? (
            <Text style={styles.muted} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

export default function Profile() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const toast = useToast();
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: ({ signal }) => api.addresses(signal),
  });
  const main = addresses.data?.find((address) => address.main);
  const fullName = [user!.name, user!.surname].filter(Boolean).join(' ');
  return (
    <Screen safeBottom={false}>
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        <Avatar userId={user!.id} version={user!.avatarVersion} name={fullName} size={96} />
        <Text style={styles.title}>{displayName(user!.name, user!.nickname)}</Text>
        {user!.nickname ? <Text style={styles.subtitle}>{fullName}</Text> : null}
        <Text style={styles.muted}>{user!.email}</Text>
      </View>
      <View style={[styles.surface, { gap: 0, paddingVertical: 6 }]}>
        <MenuRow
          icon="user"
          title="Editar perfil"
          detail="Nombre, apodo, foto, teléfono y más"
          onPress={() => router.push('/account')}
        />
        <View style={styles.divider} />
        <MenuRow
          icon="map-pin"
          title="Mis direcciones"
          detail={
            main
              ? `Principal: ${main.label} (${addressTypeLabels[main.type]})`
              : 'Agrega tu casa, oficina u otros lugares de partida'
          }
          onPress={() => router.push('/addresses')}
        />
        {user!.role === 'ADMIN' && (
          <>
            <View style={styles.divider} />
            <MenuRow icon="shield" title="Administración" onPress={() => router.push('/admin')} />
          </>
        )}
      </View>
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

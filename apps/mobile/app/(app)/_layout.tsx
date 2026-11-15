import { Redirect, Stack, usePathname } from 'expo-router';
import { useSession } from '../../src/session';
import { Screen, Loading, ErrorState, colors } from '../../src/ui';
export default function AppLayout() {
  const { user, loading, error, retry } = useSession();
  const pathname = usePathname();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <ErrorState error={error} retry={retry} />
      </Screen>
    );
  if (!user) return <Redirect href={{ pathname: '/login', params: { returnTo: pathname } }} />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="plans/[id]" options={{ title: 'El plan' }} />
      <Stack.Screen name="plans/new" options={{ title: 'Crear plan' }} />
      <Stack.Screen name="plans/[id]/edit" options={{ title: 'Editar plan' }} />
      <Stack.Screen name="plans/[id]/proposal" options={{ title: 'Nueva propuesta' }} />
      <Stack.Screen name="join/index" options={{ title: 'Unirme a un plan' }} />
      <Stack.Screen name="admin" options={{ title: 'Administración' }} />
    </Stack>
  );
}

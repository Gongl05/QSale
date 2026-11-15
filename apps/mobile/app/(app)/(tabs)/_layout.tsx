import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/session';
import { colors } from '../../../src/ui';
export default function TabLayout() {
  const notices = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: ({ signal }) => api.notifications({ page: 0, size: 10 }, signal),
  });
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold' },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mis planes',
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="calendar"
              color={typeof color === 'string' ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificaciones',
          tabBarBadge: notices.data?.unreadCount || undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="bell"
              color={typeof color === 'string' ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi perfil',
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="user"
              color={typeof color === 'string' ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/session";
import { useUI } from "../../../src/ui";
export default function TabLayout() {
  const { colors } = useUI();
  const insets = useSafeAreaInsets();
  const notices = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: ({ signal }) => api.notifications({ page: 0, size: 10 }, signal),
  });
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.ink,
        headerTitleStyle: {
          fontFamily: "Manrope_600SemiBold",
          fontWeight: "600",
        },
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: "Manrope_500Medium",
          fontSize: 12,
          lineHeight: 18,
          minHeight: 18,
          flexShrink: 0,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mis planes",
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="calendar"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notificaciones",
          tabBarBadge: notices.data?.unreadCount || undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="bell"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Mi perfil",
          tabBarIcon: ({ color, size }) => (
            <Feather
              name="user"
              color={typeof color === "string" ? color : colors.muted}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

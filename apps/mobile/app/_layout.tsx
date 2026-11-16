import { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import {
  useFonts,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, queryClient } from "../src/session";
import { ErrorBoundary, Loading, ToastProvider, useUI } from "../src/ui";
export default function Root() {
  const { colors, styles, dark } = useUI();
  const [fonts, error] = useFonts({ Manrope_500Medium, Manrope_600SemiBold });
  useEffect(() => {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) =>
        setOnline(
          state.isConnected !== false && state.isInternetReachable !== false,
        ),
      ),
    );
    const subscription = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  if (!fonts && !error)
    return (
      <SafeAreaProvider>
        <Loading label="Preparando Quesale…" />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <SessionProvider>
              <StatusBar style={dark ? "light" : "dark"} />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.ink,
                  headerTitleStyle: {
                    fontFamily: "Manrope_600SemiBold",
                    fontWeight: "600",
                  },
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen
                  name="register"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="forgot-password"
                  options={{ title: "Recuperar contraseña" }}
                />
                <Stack.Screen
                  name="+not-found"
                  options={{ title: "Quesale" }}
                />
              </Stack>
            </SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

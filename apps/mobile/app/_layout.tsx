import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, queryClient } from '../src/session';
import { ErrorBoundary, Loading, ToastProvider, colors } from '../src/ui';
export default function Root() {
  const [fonts, error] = useFonts({ Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  useEffect(() => {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) =>
        setOnline(state.isConnected !== false && state.isInternetReachable !== false),
      ),
    );
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  if (!fonts && !error)
    return (
      <SafeAreaProvider>
        <Loading label="Preparando QSale…" />
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <SessionProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.ink,
                  headerTitleStyle: { fontFamily: 'Manrope_800ExtraBold' },
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" options={{ title: 'QSale' }} />
              </Stack>
            </SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createApiClient,
  createQSaleApi,
  retryRead,
  toApiError,
} from '@qsale/api-client';
import type { SignInInput, SignUpInput, Tokens, User } from '@qsale/contracts';

const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? '127.0.0.1';
export const apiURL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${Platform.OS === 'web' ? '127.0.0.1' : devHost}:19080/api/v1` : '');
const authHTTP = axios.create({ baseURL: apiURL + '/auth', timeout: 12000 });
let tokens: Tokens | null = null;
let epoch = 0;
let pendingRefresh: Promise<string> | null = null;
let expired = () => {};
const storageKey = 'qsale.session';
async function save(value: Tokens | null) {
  // Browser previews use memory; the distributed Android/iOS app uses encrypted storage.
  if (Platform.OS !== 'web') {
    if (value)
      await SecureStore.setItemAsync(storageKey, JSON.stringify(value), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else await SecureStore.deleteItemAsync(storageKey);
  }
  tokens = value;
}
async function refresh() {
  if (!tokens?.refreshToken) throw new ApiError('Inicia sesión para continuar.', 401);
  const generation = epoch;
  pendingRefresh ??= authHTTP
    .post<Tokens>('/refresh', { refreshToken: tokens.refreshToken })
    .then(async ({ data }) => {
      if (generation !== epoch) throw new ApiError('La sesión cambió.', 401);
      await save(data);
      return data.token;
    })
    .catch((error) => {
      throw toApiError(error);
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: retryRead, staleTime: 30000 },
    mutations: { retry: false, networkMode: 'always' },
  },
});
export const api = createQSaleApi(
  createApiClient({
    baseURL: apiURL,
    getAccessToken: () => tokens?.token ?? null,
    refresh,
    onSessionExpired: () => expired(),
  }),
);
interface Session {
  user: User | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}
const Context = createContext<Session | null>(null);
export const useSession = () => useContext(Context)!;
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    expired = () => {
      epoch++;
      tokens = null;
      setUser(null);
      queryClient.clear();
      void save(null).catch(() => {});
    };
    setLoading(true);
    setError(null);
    (async () => {
      if (!apiURL || (!__DEV__ && !apiURL.startsWith('https://')))
        throw new ApiError(
          'El servicio aún no está configurado. Contacta al equipo de QSale.',
          503,
        );
      if (Platform.OS !== 'web') {
        const saved = await SecureStore.getItemAsync(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (typeof parsed.token === 'string' && typeof parsed.refreshToken === 'string')
              tokens = parsed;
            else await save(null);
          } catch {
            await save(null);
          }
        }
      }
      if (tokens) {
        const profile = await api.me();
        if (active) setUser(profile);
      }
    })()
      .catch((error) => {
        if (active && !(error instanceof ApiError && error.status === 401)) setError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function authenticate(action: 'signin' | 'signup', input: SignInInput | SignUpInput) {
    try {
      const { data } = await authHTTP.post<Tokens>('/' + action, input);
      epoch++;
      await save(data);
      queryClient.clear();
      setUser(await api.me());
    } catch (error) {
      const normalized = toApiError(error);
      if (action === 'signin' && normalized.status === 401)
        throw new ApiError('El correo o la contraseña no coinciden.', 401);
      if (action === 'signup' && normalized.status === 409)
        throw new ApiError('Este correo ya tiene una cuenta. Inicia sesión.', 409);
      throw normalized;
    }
  }
  return (
    <Context
      value={{
        user,
        loading,
        error,
        retry: () => setAttempt((x) => x + 1),
        updateUser: setUser,
        signIn: (input) => authenticate('signin', input),
        signUp: (input) => authenticate('signup', input),
        signOut: async () => {
          epoch++;
          await save(null);
          setUser(null);
          queryClient.clear();
        },
      }}
    >
      {children}
    </Context>
  );
}

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
import { orderedSessionWriter } from './session-persistence';

const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? '127.0.0.1';
export const apiURL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${Platform.OS === 'web' ? '127.0.0.1' : devHost}:19080/api/v1` : '');
if (!__DEV__ && !/^https:\/\//i.test(apiURL)) throw new Error('Production requires an HTTPS API URL.');
const authHTTP = axios.create({ baseURL: apiURL + '/auth', timeout: 12000 });
let tokens: Tokens | null = null;
let epoch = 0;
let pendingRefresh: Promise<string> | null = null;
let expired = () => {};
const storageKey = 'qsale.session';
const persist = orderedSessionWriter<Tokens | null>(async (value) => {
  // Browser previews use memory; the distributed Android/iOS app uses encrypted storage.
  if (Platform.OS !== 'web') {
    if (value)
      await SecureStore.setItemAsync(storageKey, JSON.stringify(value), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else await SecureStore.deleteItemAsync(storageKey);
  }
});
async function save(value: Tokens | null, generation = epoch) {
  if (generation !== epoch) throw new axios.CanceledError('La sesión cambió.');
  tokens = value;
  await persist(value, () => generation === epoch);
  if (generation !== epoch) throw new axios.CanceledError('La sesión cambió.');
}
async function refresh() {
  if (!tokens?.refreshToken) throw new ApiError('Inicia sesión para continuar.', 401);
  if (pendingRefresh) return pendingRefresh;
  const generation = epoch;
  const request = authHTTP
    .post<Tokens>('/refresh', { refreshToken: tokens.refreshToken })
    .then(async ({ data }) => {
      if (generation !== epoch) throw new axios.CanceledError('La sesión cambió.');
      await save(data, generation);
      return data.token;
    })
    .catch((error) => {
      if (axios.isCancel(error)) throw error;
      throw toApiError(error);
    })
    .finally(() => {
      if (pendingRefresh === request) pendingRefresh = null;
    });
  pendingRefresh = request;
  return request;
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
    getSessionGeneration: () => epoch,
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
      pendingRefresh = null;
      tokens = null;
      setUser(null);
      queryClient.clear();
      void save(null).catch(() => {});
    };
    setLoading(true);
    setError(null);
    const started = epoch;
    (async () => {
      if (!apiURL || (!__DEV__ && !apiURL.startsWith('https://')))
        throw new ApiError(
          'El servicio aún no está configurado. Contacta al equipo de QSale.',
          503,
        );
      if (Platform.OS !== 'web') {
        const saved = await SecureStore.getItemAsync(storageKey);
        if (started !== epoch) throw new axios.CanceledError('La sesión cambió.');
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
        if (axios.isCancel(error)) return;
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
    const generation = ++epoch;
    pendingRefresh = null;
    try {
      const { data } = await authHTTP.post<Tokens>('/' + action, input);
      await save(data, generation);
      queryClient.clear();
      const profile = await api.me();
      if (generation === epoch) setUser(profile);
    } catch (error) {
      if (axios.isCancel(error)) throw error;
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
          const started = epoch;
          if (tokens?.refreshToken) {
            try {
              await authHTTP.post('/logout', { refreshToken: tokens.refreshToken });
            } catch (error) {
              const normalized = toApiError(error);
              if (![400, 401, 403].includes(normalized.status)) throw normalized;
            }
          }
          if (started !== epoch) return;
          epoch++;
          pendingRefresh = null;
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

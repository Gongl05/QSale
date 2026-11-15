import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { QueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createApiClient,
  createQSaleApi,
  retryRead,
  toApiError,
} from '@qsale/api-client';
import type { SignInInput, SignUpInput, User } from '@qsale/contracts';

let accessToken: string | null = null;
let refreshRequest: Promise<string> | null = null;
const sessionHTTP = axios.create({ baseURL: '/session', timeout: 12_000 });
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: retryRead, staleTime: 30_000 },
    mutations: { retry: false, networkMode: 'always' },
  },
});
let expireSession = () => {};
async function refresh() {
  refreshRequest ??= sessionHTTP
    .post<{ token: string }>('/refresh')
    .then(({ data }) => {
      accessToken = data.token;
      return data.token;
    })
    .catch((error) => {
      accessToken = null;
      throw toApiError(error);
    })
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}
export const api = createQSaleApi(
  createApiClient({
    baseURL: '/backend/api/v1',
    getAccessToken: () => accessToken,
    refresh,
    onSessionExpired: () => expireSession(),
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    expireSession = () => {
      accessToken = null;
      setUser(null);
      queryClient.clear();
    };
    setLoading(true);
    setError(null);
    refresh()
      .then(() => api.me())
      .then((value) => {
        if (active) setUser(value);
      })
      .catch((error) => {
        if (active && !(error instanceof ApiError && [400, 401, 403].includes(error.status)))
          setError(error);
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
      const { data } = await sessionHTTP.post<{ token: string }>('/' + action, input);
      accessToken = data.token;
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
        retry: () => retry((x) => x + 1),
        signIn: (input) => authenticate('signin', input),
        signUp: (input) => authenticate('signup', input),
        updateUser: setUser,
        signOut: async () => {
          try {
            await sessionHTTP.post('/logout');
          } catch (error) {
            throw toApiError(error);
          }
          accessToken = null;
          setUser(null);
          queryClient.clear();
        },
      }}
    >
      {children}
    </Context>
  );
}

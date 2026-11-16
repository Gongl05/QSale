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
let generation = 0;
let sessionController = new AbortController();
function changeSession() {
  generation++;
  sessionController.abort();
  sessionController = new AbortController();
  refreshRequest = null;
  accessToken = null;
  return generation;
}
const sessionHTTP = axios.create({ baseURL: '/session', timeout: 12_000 });
const csrfHTTP = axios.create({ baseURL: '/session', timeout: 12_000 });
let csrfRequest: Promise<string> | null = null;
async function csrfToken() {
  if (!csrfRequest) {
    const pending = csrfHTTP.get<{token: string}>('/csrf').then(({data}) => data.token)
      .finally(() => { if (csrfRequest === pending) csrfRequest = null; });
    csrfRequest = pending;
  }
  return csrfRequest;
}
sessionHTTP.interceptors.request.use(async config => {
  if (!['get', 'head', 'options'].includes(config.method ?? 'get'))
    config.headers.set('X-CSRF-Token', await csrfToken());
  return config;
});
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: retryRead, staleTime: 30_000 },
    mutations: { retry: false, networkMode: 'always' },
  },
});
let expireSession = () => {};
async function refresh() {
  if (refreshRequest) return refreshRequest;
  const started = generation;
  const send = () => sessionHTTP.post<{ token: string }>('/refresh', undefined, {
    signal: sessionController.signal,
  });
  const request = (navigator.locks
    ? navigator.locks.request('qsale-session-refresh', send)
    : send())
    .then(({ data }) => {
      if (started !== generation) throw new axios.CanceledError('La sesión cambió.');
      accessToken = data.token;
      return data.token;
    })
    .catch((error) => {
      if (axios.isCancel(error)) throw error;
      if (started === generation) accessToken = null;
      throw toApiError(error);
    })
    .finally(() => {
      if (refreshRequest === request) refreshRequest = null;
    });
  refreshRequest = request;
  return request;
}
const browserHTTP = createApiClient({
    baseURL: '/backend/api/v1',
    getAccessToken: () => accessToken,
    getSessionGeneration: () => generation,
    refresh,
    onSessionExpired: () => expireSession(),
  });
browserHTTP.interceptors.request.use(async config => {
  if (!['get', 'head', 'options'].includes(config.method ?? 'get'))
    config.headers.set('X-CSRF-Token', await csrfToken());
  return config;
});
export const api = createQSaleApi(browserHTTP);

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
      changeSession();
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
        if (axios.isCancel(error)) return;
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
    const started = changeSession();
    try {
      const { data } = await sessionHTTP.post<{ token: string }>('/' + action, input, {
        signal: sessionController.signal,
      });
      if (started !== generation) throw new axios.CanceledError('La sesión cambió.');
      accessToken = data.token;
      queryClient.clear();
      const profile = await api.me();
      if (started === generation) setUser(profile);
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
        retry: () => retry((x) => x + 1),
        signIn: (input) => authenticate('signin', input),
        signUp: (input) => authenticate('signup', input),
        updateUser: setUser,
        signOut: async () => {
          const previousToken = accessToken;
          const started = changeSession();
          try {
            await sessionHTTP.post('/logout', undefined, { signal: sessionController.signal });
          } catch (error) {
            if (started === generation) accessToken = previousToken;
            if (axios.isCancel(error)) throw error;
            throw toApiError(error);
          }
          if (started !== generation) return;
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

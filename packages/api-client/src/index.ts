import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type {
  Availability,
  AvailabilityInput,
  Commitment,
  CommitmentStatus,
  Feasibility,
  Geography,
  Location,
  Notification,
  NotificationPage,
  OptionInput,
  Page,
  Participant,
  Plan,
  PlanDetail,
  PlanFilters,
  PlanInput,
  PlanOption,
  User,
} from '@qsale/contracts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get recoverable() {
    return this.status === 0 || [502, 503, 504].includes(this.status);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error))
    return new ApiError('No pudimos completar la acción. Inténtalo de nuevo.', 500);
  const status = error.response?.status ?? 0;
  const messages: Record<number, string> = {
    0: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
    400: 'Revisa los datos antes de continuar.',
    401: 'Tu sesión terminó. Inicia sesión para continuar.',
    403: 'No tienes permiso para esta acción.',
    404: 'No encontramos lo que buscabas.',
    409: 'La información cambió o esta acción ya se registró. Actualiza e inténtalo de nuevo.',
    429: 'Hay demasiados intentos. Espera un momento y vuelve a intentarlo.',
    500: 'Algo salió mal. Inténtalo de nuevo.',
    502: 'El servicio no está disponible por el momento.',
    503: 'El servicio no está disponible por el momento.',
    504: 'La respuesta tardó demasiado. Vuelve a intentarlo.',
  };
  const fields = error.response?.data?.fieldErrors;
  return new ApiError(
    messages[status] ?? messages[500]!,
    status,
    fields && typeof fields === 'object'
      ? Object.fromEntries(
          Object.entries(fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {},
  );
}

interface SessionAdapter {
  baseURL: string;
  getAccessToken: () => string | null | Promise<string | null>;
  refresh: () => Promise<string>;
  onSessionExpired: () => void;
}
type RetriedRequest = InternalAxiosRequestConfig & { sessionRetried?: boolean };

export function createApiClient(adapter: SessionAdapter) {
  const client = axios.create({
    baseURL: adapter.baseURL,
    timeout: 12_000,
    headers: { 'Content-Type': 'application/json' },
  });
  let refreshInFlight: Promise<string> | null = null;
  client.interceptors.request.use(async (config) => {
    const token = await adapter.getAccessToken();
    if (token) config.headers.set('Authorization', 'Bearer ' + token);
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (axios.isCancel(error)) throw error;
      const config = error.config as RetriedRequest | undefined;
      if (error.response?.status === 401 && config && !config.sessionRetried) {
        if (config.signal?.aborted) throw new axios.CanceledError();
        config.sessionRetried = true;
        try {
          const current = await adapter.getAccessToken();
          const outdated = current && config.headers.get('Authorization') !== 'Bearer ' + current;
          if (!outdated)
            refreshInFlight ??= adapter.refresh().finally(() => {
              refreshInFlight = null;
            });
          const token = outdated ? current : await refreshInFlight!;
          if (config.signal?.aborted) throw new axios.CanceledError();
          config.headers.set('Authorization', 'Bearer ' + token);
          return client.request(config);
        } catch (refreshError) {
          if (axios.isCancel(refreshError)) throw refreshError;
          const normalized = toApiError(refreshError);
          if ([400, 401, 403].includes(normalized.status)) adapter.onSessionExpired();
          throw normalized;
        }
      }
      if (error.response?.status === 401) adapter.onSessionExpired();
      throw toApiError(error);
    },
  );
  return client;
}

export function createQSaleApi(http: AxiosInstance) {
  const read = async <T>(url: string, params?: object, signal?: AbortSignal) =>
    (await http.get<T>(url, { params, signal })).data;
  const send = async <T>(
    method: 'post' | 'put' | 'patch' | 'delete',
    url: string,
    data?: unknown,
  ) => (await http.request<T>({ method, url, data })).data;
  return {
    me: (signal?: AbortSignal) => read<User>('/users/me', undefined, signal),
    updateMe: (data: { name: string; location?: Location }) => send<User>('put', '/users/me', data),
    plans: (params: PlanFilters, signal?: AbortSignal) =>
      read<Page<Plan>>('/plans', params, signal),
    plan: (id: number, signal?: AbortSignal) => read<PlanDetail>('/plans/' + id, undefined, signal),
    createPlan: (data: PlanInput) => send<PlanDetail>('post', '/plans', data),
    updatePlan: (id: number, data: PlanInput) => send<PlanDetail>('put', '/plans/' + id, data),
    closePlan: (id: number) => send<PlanDetail>('patch', `/plans/${id}/close`),
    cancelPlan: (id: number) => send<PlanDetail>('patch', `/plans/${id}/cancel`),
    deletePlan: (id: number) => send<void>('delete', '/plans/' + id),
    participants: (id: number, signal?: AbortSignal) =>
      read<Participant[]>(`/plans/${id}/participants`, undefined, signal),
    invite: (id: number, email: string) =>
      send<Participant>('post', `/plans/${id}/participants`, { email }),
    acceptInvitation: (id: number) => send<Participant>('patch', `/plans/${id}/participants/me`),
    join: (code: string) =>
      send<Participant>('post', '/plans/join/' + encodeURIComponent(code.trim().toUpperCase())),
    removeParticipant: (planId: number, userId: number) =>
      send<void>('delete', `/plans/${planId}/participants/${userId}`),
    options: (id: number, signal?: AbortSignal) =>
      read<PlanOption[]>(`/plans/${id}/options`, undefined, signal),
    createOption: (id: number, data: OptionInput) =>
      send<PlanOption>('post', `/plans/${id}/options`, data),
    deleteOption: (planId: number, optionId: number) =>
      send<void>('delete', `/plans/${planId}/options/${optionId}`),
    vote: (id: number) => send<unknown>('post', `/options/${id}/votes`),
    removeVote: (id: number) => send<void>('delete', `/options/${id}/votes`),
    availabilities: (id: number, signal?: AbortSignal) =>
      read<Availability[]>(`/plans/${id}/availabilities`, undefined, signal),
    addAvailability: (id: number, data: AvailabilityInput) =>
      send<Availability>('post', `/plans/${id}/availabilities`, data),
    deleteAvailability: (planId: number, id: number) =>
      send<void>('delete', `/plans/${planId}/availabilities/${id}`),
    commitments: (id: number, signal?: AbortSignal) =>
      read<Commitment[]>(`/plans/${id}/commitments`, undefined, signal),
    respond: (id: number, status: CommitmentStatus, note?: string) =>
      send<Commitment>('put', `/plans/${id}/commitments/me`, { status, note }),
    feasibility: (id: number, signal?: AbortSignal) =>
      read<Feasibility>(`/plans/${id}/feasibility`, undefined, signal),
    geography: (id: number, signal?: AbortSignal) =>
      read<Geography>(`/plans/${id}/geography`, undefined, signal),
    notifications: (
      params: { page: number; size: number; unreadOnly?: boolean },
      signal?: AbortSignal,
    ) => read<NotificationPage>('/notifications/page', params, signal),
    markRead: (id: number) => send<Notification>('patch', `/notifications/${id}/read`),
    users: (signal?: AbortSignal) => read<User[]>('/admin/users', undefined, signal),
    updateRole: (id: number, role: User['role']) =>
      send<User>('patch', `/admin/users/${id}/role`, { role }),
  };
}

export type QSaleApi = ReturnType<typeof createQSaleApi>;
export function retryRead(failureCount: number, error: Error) {
  return failureCount < 2 && error instanceof ApiError && error.recoverable;
}

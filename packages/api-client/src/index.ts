import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type {
  Availability,
  AvailabilityInput,
  Commitment,
  CommitmentStatus,
  DateRecommendation,
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
  Reschedule,
  RescheduleInput,
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

export function createPasswordRecoveryClient(baseURL: string, mode: 'api' | 'session' = 'api') {
  const http = axios.create({ baseURL, timeout: 12_000 });
  async function send(kind: 'request' | 'confirm', body: object) {
    const endpoint = mode === 'session' ? `/password-reset-${kind}` : `/auth/password-reset/${kind}`;
    try {
      await http.post(endpoint, body);
    } catch (error) {
      const normalized = toApiError(error);
      if (kind === 'confirm' && normalized.status === 400)
        throw new ApiError('El enlace venció o ya se usó. Solicita uno nuevo y revisa la contraseña.', 400);
      throw normalized;
    }
  }
  return {
    request: (email: string) => send('request', { email: email.trim() }),
    confirm: (token: string, password: string) => send('confirm', { token, password }),
  };
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

export const isCanceledRequest = axios.isCancel;
async function contextual<T>(request: Promise<T>, messages: Record<number, string>) {
  try {
    return await request;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    const normalized = toApiError(error);
    throw new ApiError(
      messages[normalized.status] ?? normalized.message,
      normalized.status,
      normalized.fieldErrors,
    );
  }
}

interface SessionAdapter {
  baseURL: string;
  getAccessToken: () => string | null | Promise<string | null>;
  getSessionGeneration?: () => number;
  refresh: () => Promise<string>;
  onSessionExpired: () => void;
}
type RetriedRequest = InternalAxiosRequestConfig & {
  sessionRetried?: boolean;
  sessionGeneration?: number;
};

export function createApiClient(adapter: SessionAdapter) {
  const client = axios.create({
    baseURL: adapter.baseURL,
    timeout: 12_000,
    headers: { 'Content-Type': 'application/json' },
  });
  let refreshInFlight: Promise<string> | null = null;
  let refreshGeneration: number | undefined;
  const requireCurrentSession = (config?: RetriedRequest) => {
    if (
      config?.sessionGeneration !== undefined &&
      config.sessionGeneration !== adapter.getSessionGeneration?.()
    )
      throw new axios.CanceledError('La sesión cambió.');
  };
  client.interceptors.request.use(async (config) => {
    const request = config as RetriedRequest;
    request.sessionGeneration ??= adapter.getSessionGeneration?.();
    requireCurrentSession(request);
    const token = await adapter.getAccessToken();
    requireCurrentSession(request);
    if (token) config.headers.set('Authorization', 'Bearer ' + token);
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      requireCurrentSession(response.config as RetriedRequest);
      return response;
    },
    async (error: AxiosError) => {
      if (axios.isCancel(error)) throw error;
      const config = error.config as RetriedRequest | undefined;
      requireCurrentSession(config);
      if (error.response?.status === 401 && config && !config.sessionRetried) {
        if (config.signal?.aborted) throw new axios.CanceledError();
        config.sessionRetried = true;
        try {
          const current = await adapter.getAccessToken();
          const outdated = current && config.headers.get('Authorization') !== 'Bearer ' + current;
          if (!outdated) {
            if (refreshGeneration !== config.sessionGeneration) {
              refreshInFlight = null;
              refreshGeneration = config.sessionGeneration;
            }
            if (!refreshInFlight) {
              const request = adapter.refresh().finally(() => {
                if (refreshInFlight === request) refreshInFlight = null;
              });
              refreshInFlight = request;
            }
          }
          const token = outdated ? current : await refreshInFlight!;
          requireCurrentSession(config);
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
    updateMe: (data: { name: string; location?: Location; removeLocation?: boolean }) =>
      send<User>('put', '/users/me', data),
    plans: (params: PlanFilters, signal?: AbortSignal) =>
      read<Page<Plan>>('/plans', params, signal),
    plan: (id: number, signal?: AbortSignal) => read<PlanDetail>('/plans/' + id, undefined, signal),
    createPlan: (data: PlanInput) => send<PlanDetail>('post', '/plans', data),
    updatePlan: (id: number, data: PlanInput) => send<PlanDetail>('put', '/plans/' + id, data),
    closePlan: (id: number) => send<PlanDetail>('patch', `/plans/${id}/close`),
    reopenPlan: (id: number) => send<PlanDetail>('patch', `/plans/${id}/reopen`),
    dateRecommendations: (id: number, signal?: AbortSignal) =>
      read<DateRecommendation[]>(`/plans/${id}/date-recommendations`, undefined, signal),
    reschedules: (id: number, signal?: AbortSignal) =>
      read<Reschedule[]>(`/plans/${id}/reschedules`, undefined, signal),
    createReschedule: (id: number, data: RescheduleInput) =>
      contextual(send<Reschedule>('post', `/plans/${id}/reschedules`, data), {
        400: 'Propón un día u otro lugar diferente al acuerdo actual. El día debe ser vigente y el lugar válido. Si al plan le falta día o lugar, quien organiza debe reabrirlo.',
        409: 'El acuerdo cambió. Actualiza el plan antes de proponer otra reprogramación.',
      }),
    voteReschedule: (planId: number, id: number, accepted: boolean) =>
      contextual(send<Reschedule>('put', `/plans/${planId}/reschedules/${id}/vote`, { accepted }), {
        409: 'Esta propuesta terminó o cambió el acuerdo. Actualiza para ver el resultado.',
      }),
    applyReschedule: (planId: number, id: number) =>
      contextual(send<Reschedule>('patch', `/plans/${planId}/reschedules/${id}/apply`), {
        400: 'Todavía faltan votos afirmativos para alcanzar la mayoría y el mínimo de asistentes. Actualiza el plan.',
        409: 'Esta propuesta terminó o cambió el acuerdo. Actualiza para ver el resultado.',
      }),
    withdrawReschedule: (planId: number, id: number) =>
      send<Reschedule>('patch', `/plans/${planId}/reschedules/${id}/withdraw`),
    cancelPlan: (id: number) => send<PlanDetail>('patch', `/plans/${id}/cancel`),
    deletePlan: (id: number) => send<void>('delete', '/plans/' + id),
    participants: (id: number, signal?: AbortSignal) =>
      read<Participant[]>(`/plans/${id}/participants`, undefined, signal),
    invite: (id: number, email: string) =>
      contextual(send<Participant>('post', `/plans/${id}/participants`, { email }), {
        404: 'Ese correo aún no tiene cuenta en Quesale. Comparte el enlace o código del plan para que se registre y se una.',
        409: 'Esa persona ya pertenece al grupo o tiene una invitación pendiente. Revisa El grupo.',
      }),
    acceptInvitation: (id: number) => send<Participant>('patch', `/plans/${id}/participants/me`),
    join: (code: string) =>
      contextual(
        send<Participant>('post', '/plans/join/' + encodeURIComponent(code.trim().toUpperCase())),
        {
          404: 'No encontramos un plan con ese código. Pide una invitación vigente a quien organiza.',
          400: 'Este plan ya no acepta participantes. Pide otra invitación a quien organiza.',
        },
      ),
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
      contextual(send<User>('patch', `/admin/users/${id}/role`, { role }), {
        400: 'Quesale debe conservar al menos un administrador. Asigna ese acceso a otra persona antes de retirarlo.',
      }),
  };
}

export type QSaleApi = ReturnType<typeof createQSaleApi>;
export function retryRead(failureCount: number, error: Error) {
  return failureCount < 2 && error instanceof ApiError && error.recoverable;
}

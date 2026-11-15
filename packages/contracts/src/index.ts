import { z } from 'zod';

export const planTypes = [
  'DINNER',
  'PARTY',
  'TRIP',
  'SPORTS',
  'CULTURAL',
  'STUDY',
  'OTHER',
] as const;
export type PlanType = (typeof planTypes)[number];
export type PlanStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type FeasibilityStatus = 'NOT_VIABLE' | 'TO_BE_DEFINED' | 'READY_TO_CLOSE';
export type ParticipantRole = 'ORGANIZER' | 'GUEST';
export type ParticipationStatus = 'INVITED' | 'JOINED';
export type CommitmentStatus = 'CONFIRMED' | 'INTERESTED' | 'CANT_GO';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string | null;
  district?: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  location: Location | null;
}

export interface Tokens {
  token: string;
  refreshToken: string;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Plan {
  id: number;
  name: string;
  type: PlanType;
  status: PlanStatus;
  feasibilityStatus: FeasibilityStatus;
  feasibilityScore: number;
  minParticipants: number;
  budget: number | null;
  tentativeStartDate: string | null;
  tentativeEndDate: string | null;
  creatorName: string;
  createdAt: string;
  currentUserRole: ParticipantRole | null;
  currentUserParticipationStatus: ParticipationStatus | null;
}

export interface PlanDetail extends Plan {
  description: string | null;
  inviteCode: string;
  creatorId: number;
  closedAt: string | null;
}

export interface PlanInput {
  name: string;
  description?: string;
  type: PlanType;
  minParticipants: number;
  budget?: number | null;
  tentativeStartDate?: string | null;
  tentativeEndDate?: string | null;
}

export interface Participant {
  id: number;
  planId: number;
  userId: number;
  userName: string;
  userEmail: string;
  role: ParticipantRole;
  status: ParticipationStatus;
  invitedAt: string;
  joinedAt: string | null;
}

export interface PlanOption {
  id: number;
  type: 'DATE' | 'PLACE';
  label: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: Location | null;
  avgDistanceKm: number | null;
  avgTravelMinutes: number | null;
  selected: boolean;
  proposedByName: string;
  voteCount: number;
  score: number;
  hasVoted: boolean;
  estimateSource: 'ROUTING' | 'HAVERSINE' | 'UNKNOWN' | null;
  estimateStatus: 'NOT_APPLICABLE' | 'PENDING' | 'READY' | 'UNAVAILABLE';
  estimateUpdatedAt: string | null;
}

export interface OptionInput {
  type: 'DATE' | 'PLACE';
  label: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  location?: Location;
}

export interface Availability {
  id: number;
  userId: number;
  userName: string;
  availableDate: string;
  startTime: string | null;
  endTime: string | null;
}

export interface AvailabilityInput {
  availableDate: string;
  startTime?: string;
  endTime?: string;
}
export interface Commitment {
  id: number;
  userId: number;
  userName: string;
  status: CommitmentStatus;
  note: string | null;
  respondedAt: string;
}
export interface Feasibility {
  planId: number;
  score: number;
  status: FeasibilityStatus;
  confirmedParticipants: number;
  minParticipants: number;
  totalParticipants: number;
}
export interface Geography {
  midpoint: { latitude: number; longitude: number } | null;
  locatedParticipants: number;
  joinedParticipants: number;
}
export interface Notification {
  id: number;
  planId: number | null;
  type:
    | 'PLAN_INVITATION'
    | 'PLAN_UPDATED'
    | 'MIN_PARTICIPANTS_REACHED'
    | 'PLAN_CLOSED'
    | 'PLAN_CANCELLED';
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  readAt: string | null;
}
export interface NotificationPage extends Page<Notification> {
  unreadCount: number;
}
export interface PlanFilters {
  page?: number;
  size?: number;
  search?: string;
  status?: PlanStatus;
  sort?: string;
}

export const planTypeLabels: Record<PlanType, string> = {
  DINNER: 'Comida',
  PARTY: 'Celebración',
  TRIP: 'Viaje',
  SPORTS: 'Deporte',
  CULTURAL: 'Cultura',
  STUDY: 'Estudio',
  OTHER: 'Otro',
};
export const planStatusLabels: Record<PlanStatus, string> = {
  OPEN: 'Abierto',
  CLOSED: 'Confirmado',
  CANCELLED: 'Cancelado',
};
export const feasibilityLabels: Record<FeasibilityStatus, string> = {
  NOT_VIABLE: 'Necesita respuestas',
  TO_BE_DEFINED: 'Tomando forma',
  READY_TO_CLOSE: 'Listo para cerrar',
};
export const commitmentLabels: Record<CommitmentStatus, string> = {
  CONFIRMED: 'Confirmado',
  INTERESTED: 'Me interesa',
  CANT_GO: 'No puedo asistir',
};

export function utf8Length(value: string) {
  return Array.from(value).reduce((length, char) => {
    const code = char.codePointAt(0)!;
    return length + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
}

export function parseNumberDraft(value: string, optional = false): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return optional ? null : Number.NaN;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number.NaN;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

const email = z.email('Escribe un correo válido.').max(150, 'El correo es demasiado largo.');
export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
});
export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribe al menos dos caracteres.')
    .max(100, 'Usa hasta 100 caracteres.'),
  email,
  password: z
    .string()
    .min(8, 'Usa al menos ocho caracteres.')
    .max(64, 'Usa hasta 64 caracteres.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+$/,
      'Incluye una mayúscula, una minúscula y un número.',
    )
    .refine(
      (value) => utf8Length(value) <= 72,
      'La contraseña es demasiado larga; reduce los símbolos o caracteres.',
    ),
});
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(255).nullable().optional(),
  district: z.string().max(100).nullable().optional(),
});

export const planSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'El nombre necesita al menos tres caracteres.')
      .max(100, 'Usa hasta 100 caracteres.'),
    description: z.string().max(1000, 'Usa hasta 1000 caracteres.').optional(),
    type: z.enum(planTypes),
    minParticipants: z
      .number({ error: 'Escribe un número entero entre 2 y 100.' })
      .int('Escribe un número entero.')
      .min(2, 'El mínimo es dos personas.')
      .max(100, 'El máximo es 100 personas.'),
    budget: z
      .number({ error: 'Escribe un presupuesto válido.' })
      .nonnegative('El presupuesto no puede ser negativo.')
      .nullable()
      .optional(),
    tentativeStartDate: z.string().nullable().optional(),
    tentativeEndDate: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      !value.tentativeStartDate ||
      !value.tentativeEndDate ||
      value.tentativeEndDate >= value.tentativeStartDate,
    { message: 'La fecha final no puede ser anterior a la inicial.', path: ['tentativeEndDate'] },
  );

export function formatMoney(value: number | null | undefined) {
  return value == null
    ? 'Por definir'
    : new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        maximumFractionDigits: 2,
      }).format(value);
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'Por definir';
  const normalized =
    value.length === 10
      ? value + 'T12:00:00-05:00'
      : /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        ? value
        : value + '-05:00';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Por definir';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'short',
    ...(withTime ? ({ hour: 'numeric', minute: '2-digit' } as const) : {}),
  }).format(date);
}

export function canManagePlan(plan: Plan, user: User | null) {
  return (
    plan.status === 'OPEN' &&
    (user?.role === 'ADMIN' ||
      (plan.currentUserRole === 'ORGANIZER' && plan.currentUserParticipationStatus === 'JOINED'))
  );
}

export function canContribute(plan: Plan) {
  return plan.status === 'OPEN' && plan.currentUserParticipationStatus === 'JOINED';
}

export function safeReturnPath(value: unknown, fallback = '/plans') {
  return typeof value === 'string' &&
    /^\/(plans(?:\/|\?|$)|join(?:\/|\?|$)|notifications(?:\?|$)|profile(?:\?|$)|admin(?:\/|\?|$))/.test(
      value,
    )
    ? value
    : fallback;
}

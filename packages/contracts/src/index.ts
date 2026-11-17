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

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export const genderLabels: Record<Gender, string> = {
  MALE: 'Hombre',
  FEMALE: 'Mujer',
  OTHER: 'Otro',
  PREFER_NOT_TO_SAY: 'Prefiero no decirlo',
};

export interface User {
  id: number;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
  avatarVersion?: number | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  location: Location | null;
}

export interface ProfileInput {
  name: string;
  surname?: string | null;
  nickname?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
}

export type AddressType = 'HOME' | 'WORK' | 'OTHER';
export const addressTypeLabels: Record<AddressType, string> = {
  HOME: 'Casa',
  WORK: 'Oficina',
  OTHER: 'Otro',
};
export interface SavedAddress {
  id: number;
  label: string;
  type: AddressType;
  favorite: boolean;
  main: boolean;
  location: Location;
}
export interface SavedAddressInput {
  label: string;
  type: AddressType;
  favorite: boolean;
  main: boolean;
  location: Location;
}

/** The name friends see in plans: the nickname when the person set one. */
export function displayName(name: string, nickname?: string | null) {
  return nickname?.trim() || name;
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
  version: number;
  name: string;
  type: PlanType;
  status: PlanStatus;
  feasibilityStatus: FeasibilityStatus;
  feasibilityScore: number;
  minParticipants: number;
  agreementVersion: number;
  budget: number | null;
  tentativeStartDate: string | null;
  tentativeEndDate: string | null;
  tentativeDates?: string[];
  agreedStartsAt?: string | null;
  agreedEndsAt?: string | null;
  agreedStartsOn?: string | null;
  agreedEndsOn?: string | null;
  agreedPlace?: string | null;
  agreedAddress?: string | null;
  creatorName: string;
  creatorNickname?: string | null;
  createdAt: string;
  currentUserRole: ParticipantRole | null;
  currentUserParticipationStatus: ParticipationStatus | null;
  currentUserOriginAddressId?: number | null;
  members?: PlanMember[];
  joinedCount?: number;
}

export interface PlanMember {
  userId: number;
  name: string;
  nickname: string | null;
  avatarVersion: number | null;
}

export interface PlanDetail extends Plan {
  description: string | null;
  inviteCode: string;
  creatorId: number;
  closedAt: string | null;
}

export interface PlanInput {
  version?: number;
  name: string;
  description?: string;
  type: PlanType;
  minParticipants: number;
  budget?: number | null;
  tentativeStartDate?: string | null;
  tentativeEndDate?: string | null;
  tentativeDates?: string[];
}

export interface Participant {
  id: number;
  planId: number;
  userId: number;
  userName: string;
  userNickname?: string | null;
  userAvatarVersion?: number | null;
  originAddressId?: number | null;
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
  startsOn: string | null;
  endsOn: string | null;
  location: Location | null;
  avgDistanceKm: number | null;
  avgTravelMinutes: number | null;
  selected: boolean;
  proposedByName: string;
  proposedByNickname?: string | null;
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
  startsOn?: string;
  endsOn?: string;
  location?: Location;
}

export interface Availability {
  id: number;
  userId: number;
  userName: string;
  userNickname?: string | null;
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
  userNickname?: string | null;
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
  dateReady: boolean;
  placeReady: boolean;
}
export interface DateRecommendation {
  date: string;
  availableParticipants: number;
  totalParticipants: number;
  unknownParticipants: number;
  allParticipantsAvailable: boolean;
  timeCompatible: boolean;
  commonStartTime: string | null;
  commonEndTime: string | null;
}
export type RescheduleStatus =
  'VOTING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'WITHDRAWN' | 'EXPIRED' | 'SUPERSEDED';
export interface RescheduleInput {
  date?: string;
  time?: string;
  placeOptionId?: number;
  placeLabel?: string;
  location?: Location;
  reason?: string;
  expiresAt?: string;
}
export interface Reschedule {
  id: number;
  planId: number;
  createdById: number;
  createdByName: string;
  baseAgreementVersion: number;
  date: string;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  placeOptionId: number | null;
  placeLabel: string;
  location: Location;
  reason: string | null;
  status: RescheduleStatus;
  yesVotes: number;
  noVotes: number;
  totalVoters: number;
  requiredVotes: number;
  myVote: boolean | null;
  canApply: boolean;
  canWithdraw: boolean;
  createdAt: string;
  expiresAt: string;
}
export const rescheduleLabels: Record<RescheduleStatus, string> = {
  VOTING: 'En votación',
  APPROVED: 'Lista para aplicar',
  REJECTED: 'Rechazada',
  APPLIED: 'Aplicada',
  WITHDRAWN: 'Retirada',
  EXPIRED: 'Venció',
  SUPERSEDED: 'Finalizada por cambio de plan',
};
export function isActiveReschedule(value: Reschedule) {
  return value.status === 'VOTING' || value.status === 'APPROVED';
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
    | 'PLAN_CANCELLED'
    | 'PLAN_REOPENED'
    | 'ATTENDANCE_BELOW_MINIMUM'
    | 'RESCHEDULE_PROPOSED'
    | 'RESCHEDULE_REJECTED'
    | 'RESCHEDULE_APPLIED';
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

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Escribe un correo válido.').max(150, 'El correo es demasiado largo.'));
export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña.'),
});
// Letters (with accents and ñ) separated by single spaces, apostrophes or hyphens. No numbers or symbols.
export const personNamePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const onlyLetters = 'Usa solo letras, sin números ni símbolos.';
const personName = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min > 1 ? `Escribe al menos ${min} letras.` : 'Escríbelo.')
    .max(max, `Usa hasta ${max} caracteres.`)
    .regex(personNamePattern, onlyLetters);
const optionalPersonName = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usa hasta ${max} caracteres.`)
    .refine((value) => !value || personNamePattern.test(value), onlyLetters);

export const signUpSchema = z.object({
  name: personName(2, 100),
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

export const profileSchema = z.object({
  name: personName(2, 100),
  surname: optionalPersonName(100),
  nickname: optionalPersonName(30),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || /^\+?[0-9 ]{6,19}$/.test(value), 'Escribe un número válido.'),
  birthDate: z
    .string()
    .nullable()
    .refine((value) => !value || (validDay(value) && value < todayInLima()), 'Elige una fecha pasada.'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullable(),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Ponle un nombre, como Casa u Oficina.').max(40, 'Usa hasta 40 caracteres.'),
  type: z.enum(['HOME', 'WORK', 'OTHER']),
  favorite: z.boolean(),
  main: z.boolean(),
  location: z.object(
    {
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().max(255).nullable().optional(),
      district: z.string().max(100).nullable().optional(),
    },
    { error: 'Busca la dirección o márcala en el mapa.' },
  ),
});

export const planSchema = z
  .object({
    version: z.number().int().nonnegative().optional(),
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
    tentativeStartDate: z
      .string()
      .refine(
        (value) => validDay(value) && value >= todayInLima(),
        'Elige hoy o una fecha futura válida.',
      )
      .nullable()
      .optional(),
    tentativeEndDate: z
      .string()
      .refine(
        (value) => validDay(value) && value >= todayInLima(),
        'Elige hoy o una fecha futura válida.',
      )
      .nullable()
      .optional(),
    tentativeDates: z
      .array(z.string())
      .max(31, 'Elige hasta 31 días.')
      .refine(
        (days) => days.every((day) => validDay(day) && day >= todayInLima()),
        'Los días deben ser hoy o futuros.',
      )
      .optional(),
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

/** Tentative dates as text: specific days ("21 nov., 28 nov. y 2 dic.") or a range ("21 nov. – 23 nov."). */
export function tentativeText(plan: Pick<Plan, 'tentativeStartDate' | 'tentativeEndDate' | 'tentativeDates'>) {
  const days = plan.tentativeDates ?? [];
  if (days.length) {
    const shown = days.slice(0, 3).map((day) => formatDate(day));
    const rest = days.length - shown.length;
    if (rest > 0) return shown.join(', ') + ` y ${rest} día${rest === 1 ? '' : 's'} más`;
    return shown.length > 1 ? shown.slice(0, -1).join(', ') + ' o ' + shown.at(-1) : shown[0];
  }
  if (plan.tentativeStartDate && plan.tentativeEndDate && plan.tentativeEndDate !== plan.tentativeStartDate)
    return formatDate(plan.tentativeStartDate) + ' – ' + formatDate(plan.tentativeEndDate);
  return formatDate(plan.tentativeStartDate);
}

/** First day of the agreed date (yyyy-mm-dd in Lima), or null while there is no agreement. */
export function agreedDay(plan: Pick<Plan, 'agreedStartsAt' | 'agreedStartsOn'>) {
  return plan.agreedStartsOn ?? plan.agreedStartsAt?.slice(0, 10) ?? null;
}

export interface CalendarPlan {
  name: string;
  description?: string | null;
  agreedStartsAt?: string | null;
  agreedEndsAt?: string | null;
  agreedStartsOn?: string | null;
  agreedEndsOn?: string | null;
  agreedPlace?: string | null;
  agreedAddress?: string | null;
}

const limaInstant = (value: string) =>
  new Date(value + (value.length === 10 ? 'T00:00:00' : '') + '-05:00');

/** Start and end of the agreed date; all-day when the plan only agreed on days. Null without agreement. */
export function calendarTimes(plan: CalendarPlan) {
  if (plan.agreedStartsAt) {
    const startDate = limaInstant(plan.agreedStartsAt);
    const endDate = plan.agreedEndsAt
      ? limaInstant(plan.agreedEndsAt)
      : new Date(startDate.getTime() + 2 * 3_600_000);
    return { startDate, endDate, allDay: false };
  }
  if (plan.agreedStartsOn) {
    const startDate = limaInstant(plan.agreedStartsOn);
    const endDate = new Date(
      limaInstant(plan.agreedEndsOn ?? plan.agreedStartsOn).getTime() + 86_400_000,
    );
    return { startDate, endDate, allDay: true };
  }
  return null;
}

/** Google Calendar "new event" link with the plan filled in. */
export function googleCalendarUrl(plan: CalendarPlan) {
  const times = calendarTimes(plan);
  if (!times) return null;
  const stamp = (date: Date) =>
    times.allDay
      ? new Date(date.getTime() - 5 * 3_600_000).toISOString().slice(0, 10).replaceAll('-', '')
      : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: plan.name,
    dates: stamp(times.startDate) + '/' + stamp(times.endDate),
    details: plan.description || 'Plan coordinado en QSale.',
    location: [plan.agreedPlace, plan.agreedAddress].filter(Boolean).join(', '),
    ctz: 'America/Lima',
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

export function canManagePlan(plan: Plan, user: User | null) {
  return plan.status === 'OPEN' && isOrganizer(plan, user);
}
export function isOrganizer(plan: Plan, user: User | null) {
  return (
    user?.role === 'ADMIN' ||
    (plan.currentUserRole === 'ORGANIZER' && plan.currentUserParticipationStatus === 'JOINED')
  );
}
export function canRespond(plan: Plan) {
  return plan.status !== 'CANCELLED' && plan.currentUserParticipationStatus === 'JOINED';
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

export function todayInLima() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function dateInputError(day: string, time = '', endDay = '', endTime = '') {
  if (!validDay(day) || day < todayInLima()) return 'Elige hoy o un día futuro válido.';
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return 'Usa una hora válida con formato HH:mm.';
  if (time && new Date(day + 'T' + time + '-05:00').getTime() <= Date.now())
    return 'La hora de inicio debe ser futura, o puedes dejarla vacía.';
  if (endDay && (!validDay(endDay) || endDay < day))
    return 'El día final debe ser igual o posterior al inicial.';
  if (endTime && (!endDay || !time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)))
    return 'Para indicar una hora final, completa el día final y la hora inicial.';
  if (endTime && endDay + 'T' + endTime <= day + 'T' + time)
    return 'El final debe ser posterior al inicio.';
  return '';
}
export function dateOptionInput(
  day: string,
  time = '',
  endDay = '',
  endTime = '',
): Pick<OptionInput, 'startsOn' | 'startsAt' | 'endsOn' | 'endsAt'> {
  return {
    startsOn: day,
    ...(time ? { startsAt: day + 'T' + time } : {}),
    ...(endDay ? { endsOn: endDay } : {}),
    ...(endTime ? { endsAt: endDay + 'T' + endTime } : {}),
  };
}
export function formatOptionDate(option: PlanOption) {
  const start = option.startsAt
    ? formatDate(option.startsAt, true)
    : formatDate(option.startsOn) + ' · Hora por acordar';
  const end = option.endsAt
    ? formatDate(option.endsAt, true)
    : option.endsOn
      ? formatDate(option.endsOn)
      : '';
  return start + (end ? ' – ' + end : '');
}
export function recommendationText(value: DateRecommendation) {
  const coverage = `${value.availableParticipants} de ${value.totalParticipants} disponibles`;
  const missing = value.unknownParticipants
    ? ` · ${value.unknownParticipants} sin disponibilidad registrada`
    : '';
  const hours = !value.timeCompatible
    ? ' · Sin horario común'
    : value.commonStartTime
      ? ` · Coinciden de ${value.commonStartTime.slice(0, 5)} a ${value.commonEndTime?.slice(0, 5) ?? 'fin del día'}`
      : ' · Hora por acordar';
  return coverage + missing + hours;
}

export function attendanceSummary(confirmed: number, minimum: number) {
  return `${confirmed} ${confirmed === 1 ? 'asistente confirmado' : 'asistentes confirmados'} · Mínimo ${minimum}`;
}

export function planProgressLabel(plan: Plan) {
  return plan.status === 'CLOSED'
    ? 'Acuerdo confirmado. Revisa la asistencia.'
    : plan.status === 'CANCELLED'
      ? 'Plan cancelado. Consulta el historial.'
      : feasibilityLabels[plan.feasibilityStatus];
}

export function rescheduleDateText(value: Reschedule) {
  return (
    `${formatDate(value.date)} · ${value.time?.slice(0, 5) ?? 'Hora por acordar'}` +
    (value.endDate
      ? ` – ${formatDate(value.endDate)}${value.endTime ? ' · ' + value.endTime.slice(0, 5) : ''}`
      : '')
  );
}

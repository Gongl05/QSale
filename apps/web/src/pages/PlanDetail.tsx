import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Pencil,
  Plus,
  Share2,
  ThumbsUp,
  Trash2,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  canContribute,
  canManagePlan,
  commitmentLabels,
  formatDate,
  formatMoney,
  locationSchema,
  planTypeLabels,
  type AvailabilityInput,
  type CommitmentStatus,
  type Location,
  type OptionInput,
  type Participant,
  type PlanDetail as Plan,
  type PlanOption,
} from '@qsale/contracts';
import { api, useSession } from '../session';
import { useAction } from '../hooks';
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FeasibilityIndicator,
  Field,
  Loading,
  PageHeading,
  Skeleton,
  StatusBadge,
  useToast,
} from '../ui';
import { LocationPicker, MapView, type MapPoint } from '../Map';

function DataSection<T>({
  query,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (value: T) => ReactNode;
}) {
  return query.isPending ? (
    <Skeleton rows={2} />
  ) : query.isError ? (
    <ErrorState error={query.error!} retry={() => void query.refetch()} />
  ) : (
    <>{children(query.data!)}</>
  );
}
export function ParticipantRow({
  item,
  commitment,
  canRemove,
  onRemove,
  busy,
}: {
  item: Participant;
  commitment?: CommitmentStatus;
  canRemove: boolean;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="participant-row">
      <span className="avatar">{item.userName.slice(0, 1).toUpperCase()}</span>
      <div>
        <strong>{item.userName}</strong>
        <small>
          {item.role === 'ORGANIZER'
            ? 'Organiza el plan'
            : item.status === 'INVITED'
              ? 'Invitación pendiente'
              : 'Parte del grupo'}
        </small>
      </div>
      <span className={'participant-response ' + (commitment ?? '')}>
        {item.status === 'INVITED'
          ? 'Aún no se une'
          : commitment
            ? commitmentLabels[commitment]
            : 'Sin respuesta'}
      </span>
      {canRemove && (
        <Button
          variant="quiet"
          aria-label={'Retirar a ' + item.userName}
          busy={busy}
          onClick={onRemove}
        >
          <Trash2 size={17} />
        </Button>
      )}
    </div>
  );
}
export function OptionCard({
  option,
  canVote,
  canDelete,
  onVote,
  onDelete,
  busy,
}: {
  option: PlanOption;
  canVote: boolean;
  canDelete: boolean;
  onVote: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <article className={'option-card ' + (option.selected ? 'selected' : '')}>
      <div className="option-title">
        {option.type === 'PLACE' ? <MapPin size={20} /> : <CalendarDays size={20} />}
        <h3>{option.label}</h3>
        {option.selected && (
          <span className="badge good">
            <Check size={14} />
            Elegida
          </span>
        )}
      </div>
      {option.description && <p>{option.description}</p>}
      {option.type === 'DATE' ? (
        <p className="option-main">
          {formatDate(option.startsAt, true)}
          {option.endsAt && ' – ' + formatDate(option.endsAt, true)}
        </p>
      ) : (
        <>
          <p className="option-main">{option.location?.address ?? 'Ubicación en el mapa'}</p>
          {option.estimateStatus === 'READY' ? (
            <p className="travel-estimate">
              Promedio del grupo: {option.avgDistanceKm?.toFixed(1)} km ·{' '}
              {Math.round(option.avgTravelMinutes ?? 0)} min
              <small>
                {option.estimateSource === 'ROUTING'
                  ? 'Estimación de rutas'
                  : option.estimateSource === 'HAVERSINE'
                    ? 'Aproximación en línea recta; no es una ruta de tránsito'
                    : 'Estimación guardada; origen no disponible'}
              </small>
            </p>
          ) : (
            <p className="form-hint">
              {option.estimateStatus === 'PENDING'
                ? 'Calculando estimación…'
                : 'Sin estimación: aún faltan ubicaciones del grupo.'}
            </p>
          )}
        </>
      )}
      <div className="option-footer">
        <span>
          {option.voteCount} {option.voteCount === 1 ? 'voto' : 'votos'} · Por{' '}
          {option.proposedByName}
        </span>
        <div className="actions">
          {canDelete && (
            <Button
              variant="quiet"
              aria-label={'Eliminar propuesta ' + option.label}
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </Button>
          )}
          {canVote && (
            <Button
              variant={option.hasVoted ? 'primary' : 'secondary'}
              busy={busy}
              onClick={onVote}
              aria-pressed={option.hasVoted}
            >
              <ThumbsUp size={17} />
              {option.hasVoted ? 'Quitar mi voto' : 'Votar'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function OptionForm({ planId, onClose }: { planId: number; onClose: () => void }) {
  const [type, setType] = useState<'DATE' | 'PLACE'>('DATE');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState('');
  const action = useAction(
    (data: OptionInput) => api.createOption(planId, data),
    'Propuesta lista para recibir votos.',
    onClose,
  );
  return (
    <form
      className="inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        if (label.trim().length < 3 || label.trim().length > 120) {
          setError('El título necesita entre 3 y 120 caracteres.');
          return;
        }
        if (type === 'DATE' && (!start || new Date(start + '-05:00').getTime() <= Date.now())) {
          setError('Elige una fecha y hora futuras.');
          return;
        }
        if (type === 'DATE' && end && end < start) {
          setError('El final debe ser posterior al inicio.');
          return;
        }
        if (type === 'PLACE' && !locationSchema.safeParse(location).success) {
          setError('Elige una ubicación válida para el lugar.');
          return;
        }
        action.mutate({
          type,
          label: label.trim(),
          description,
          ...(type === 'DATE'
            ? { startsAt: start, ...(end ? { endsAt: end } : {}) }
            : { location: location! }),
        });
      }}
    >
      <h3>Una nueva propuesta</h3>
      <div className="segmented" aria-label="Tipo de propuesta">
        <button type="button" aria-pressed={type === 'DATE'} onClick={() => setType('DATE')}>
          <CalendarDays size={17} />
          Fecha
        </button>
        <button type="button" aria-pressed={type === 'PLACE'} onClick={() => setType('PLACE')}>
          <MapPin size={17} />
          Lugar
        </button>
      </div>
      <Field
        label="Título de la propuesta"
        value={label}
        maxLength={120}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={
          type === 'DATE' ? 'Por ejemplo: Sábado por la tarde' : 'Por ejemplo: Parque Kennedy'
        }
      />
      <Field
        label="Un detalle para el grupo (opcional)"
        value={description}
        maxLength={500}
        onChange={(event) => setDescription(event.target.value)}
      />
      {type === 'DATE' ? (
        <div className="form-row">
          <Field
            label="Inicio (hora de Lima)"
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <Field
            label="Final (opcional)"
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      ) : (
        <LocationPicker value={location} onChange={setLocation} />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions end">
        <Button type="button" variant="secondary" disabled={action.isPending} onClick={onClose}>
          Volver
        </Button>
        <Button busy={action.isPending}>Publicar propuesta</Button>
      </div>
    </form>
  );
}
function AvailabilityForm({ planId }: { planId: number }) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const action = useAction(
    (input: AvailabilityInput) => api.addAvailability(planId, input),
    'Tu disponibilidad está guardada.',
    () => {
      setDate('');
      setStart('');
      setEnd('');
    },
  );
  return (
    <form
      className="inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        if (!date || date < today) {
          setError('Elige hoy o una fecha futura.');
          return;
        }
        if (Boolean(start) !== Boolean(end) || (start && end <= start)) {
          setError(
            'Completa ambas horas y coloca el final después del inicio, o deja ambas vacías.',
          );
          return;
        }
        action.mutate({
          availableDate: date,
          ...(start ? { startTime: start, endTime: end } : {}),
        });
      }}
    >
      <h3>¿Cuándo tienes un espacio?</h3>
      <p>Esto ayuda a calcular la viabilidad; no sustituye tu confirmación de asistencia.</p>
      <div className="form-row three">
        <Field
          label="Día"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Field
          label="Desde (opcional)"
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <Field
          label="Hasta (opcional)"
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button busy={action.isPending}>Añadir disponibilidad</Button>
    </form>
  );
}

export default function PlanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const valid = Number.isSafeInteger(planId) && planId > 0;
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [share, setShare] = useState(false);
  const [propose, setPropose] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: string;
    run: () => Promise<unknown>;
    leave?: boolean;
  } | null>(null);
  const query = useQuery({
    queryKey: ['plan', planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    enabled: valid,
  });
  const enabled = Boolean(query.data);
  const participants = useQuery({
    queryKey: ['participants', planId],
    queryFn: ({ signal }) => api.participants(planId, signal),
    enabled,
  });
  const commitments = useQuery({
    queryKey: ['commitments', planId],
    queryFn: ({ signal }) => api.commitments(planId, signal),
    enabled,
  });
  const feasibility = useQuery({
    queryKey: ['feasibility', planId],
    queryFn: ({ signal }) => api.feasibility(planId, signal),
    enabled,
  });
  const options = useQuery({
    queryKey: ['options', planId],
    queryFn: ({ signal }) => api.options(planId, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((option) => option.estimateStatus === 'PENDING') ? 4000 : false,
  });
  const availability = useQuery({
    queryKey: ['availabilities', planId],
    queryFn: ({ signal }) => api.availabilities(planId, signal),
    enabled,
  });
  const geography = useQuery({
    queryKey: ['geography', planId],
    queryFn: ({ signal }) => api.geography(planId, signal),
    enabled,
  });
  const accept = useAction(() => api.acceptInvitation(planId), 'Ya eres parte del grupo.');
  const invite = useAction(
    (email: string) => api.invite(planId, email),
    'Invitación enviada.',
    () => setEmail(''),
  );
  const vote = useAction(
    (option: PlanOption) => (option.hasVoted ? api.removeVote(option.id) : api.vote(option.id)),
    'Voto actualizado.',
  );
  const respond = useAction(
    (status: CommitmentStatus) =>
      api.respond(
        planId,
        status,
        note ?? commitments.data?.find((item) => item.userId === user!.id)?.note ?? undefined,
      ),
    'Tu respuesta está guardada.',
    () => setNote(null),
  );
  const destructive = useAction(
    async () => {
      if (confirm) await confirm.run();
    },
    'Cambio realizado.',
    () => {
      if (confirm?.leave) navigate('/plans');
      setConfirm(null);
    },
  );
  if (!valid) return <ErrorState error={new Error('El enlace del plan no es válido.')} />;
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const plan = query.data;
  const manage = canManagePlan(plan, user);
  const contribute = canContribute(plan);
  const selectedTab = params.get('tab') ?? 'proposals';
  const tab = ['proposals', 'group', 'availability', 'map'].includes(selectedTab)
    ? selectedTab
    : 'proposals';
  const ownCommitment = commitments.data?.find((item) => item.userId === user!.id);
  const link = location.origin + '/join/' + plan.inviteCode;
  const request = (
    title: string,
    description: string,
    action: string,
    run: () => Promise<unknown>,
    leave = false,
  ) => setConfirm({ title, description, action, run, leave });
  const points: MapPoint[] = (options.data ?? [])
    .filter((option) => option.type === 'PLACE' && option.location)
    .map((option) => ({ ...option.location!, label: option.label }));
  if (geography.data?.midpoint)
    points.push({ ...geography.data.midpoint, label: 'Punto medio del grupo', midpoint: true });
  return (
    <>
      <Link className="back-link" to="/plans">
        Volver a mis planes
      </Link>
      <PageHeading
        title={plan.name}
        description={
          plan.description ??
          `Un plan de ${planTypeLabels[plan.type].toLowerCase()} para compartir.`
        }
      >
        {plan.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setShare(true)}>
            <Share2 size={18} />
            Compartir
          </Button>
        )}
        {manage && (
          <Link className="button secondary" to={'/plans/' + planId + '/edit'}>
            <Pencil size={17} />
            Editar
          </Link>
        )}
      </PageHeading>
      <div className="plan-meta">
        <StatusBadge plan={plan} />
        <span>
          <CalendarDays size={17} />
          {formatDate(plan.tentativeStartDate)}
          {plan.tentativeEndDate && ' – ' + formatDate(plan.tentativeEndDate)}
        </span>
        <span>
          <Wallet size={17} />
          {formatMoney(plan.budget)} estimados
        </span>
        <span>
          <UsersRound size={17} />
          Mínimo {plan.minParticipants}
        </span>
        <span>Por {plan.creatorName}</span>
      </div>
      {plan.currentUserParticipationStatus === 'INVITED' && plan.status === 'OPEN' && (
        <section className="invitation-banner">
          <div>
            <h2>Te invitaron a este plan</h2>
            <p>Únete para proponer, votar y responder si vas.</p>
          </div>
          <Button busy={accept.isPending} onClick={() => accept.mutate(undefined)}>
            Aceptar invitación
          </Button>
        </section>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <nav className="detail-tabs" aria-label="Secciones del plan">
            {[
              ['proposals', 'Propuestas'],
              ['group', 'El grupo'],
              ['availability', 'Disponibilidad'],
              ['map', 'Mapa'],
            ].map(([key, label]) => (
              <button
                key={key}
                id={'tab-' + key}
                aria-controls="detail-panel"
                aria-pressed={tab === key}
                onClick={() => setParams({ tab: key! })}
              >
                {label}
              </button>
            ))}
          </nav>
          <section id="detail-panel" aria-labelledby={'tab-' + tab} className="tab-panel">
            {tab === 'proposals' && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>¿Cuándo y dónde?</h2>
                    <p>Elijan juntos. Puedes votar por más de una propuesta.</p>
                  </div>
                  {contribute && !propose && (
                    <Button variant="secondary" onClick={() => setPropose(true)}>
                      <Plus size={18} />
                      Proponer
                    </Button>
                  )}
                </div>
                {propose && contribute && (
                  <OptionForm planId={planId} onClose={() => setPropose(false)} />
                )}
                <DataSection query={options}>
                  {(items) =>
                    items.length ? (
                      <div className="option-list">
                        {items.map((option) => (
                          <OptionCard
                            key={option.id}
                            option={option}
                            canVote={contribute}
                            canDelete={manage}
                            busy={vote.isPending}
                            onVote={() => vote.mutate(option)}
                            onDelete={() =>
                              request(
                                '¿Eliminar esta propuesta?',
                                `Se eliminarán “${option.label}” y sus votos.`,
                                'Eliminar propuesta',
                                () => api.deleteOption(planId, option.id),
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="Las mejores ideas empiezan con alguien">
                        {contribute
                          ? 'Propón una fecha o un lugar para que el grupo vote.'
                          : 'Todavía no hay propuestas para este plan.'}
                      </EmptyState>
                    )
                  }
                </DataSection>
              </>
            )}
            {tab === 'group' && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>La gente que hace el plan</h2>
                    <p>Unirse al grupo y confirmar asistencia son pasos distintos.</p>
                  </div>
                </div>
                {manage && (
                  <form
                    className="invite-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.reportValidity()) invite.mutate(email.trim());
                    }}
                  >
                    <Field
                      label="Invitar por correo"
                      type="email"
                      required
                      value={email}
                      maxLength={150}
                      placeholder="alguien@correo.com"
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <Button busy={invite.isPending}>
                      <UserPlus size={18} />
                      Invitar
                    </Button>
                  </form>
                )}
                <DataSection query={participants}>
                  {(items) => (
                    <div className="participant-list">
                      {items.map((item) => (
                        <ParticipantRow
                          key={item.id}
                          item={item}
                          commitment={
                            commitments.data?.find((response) => response.userId === item.userId)
                              ?.status
                          }
                          canRemove={
                            plan.status === 'OPEN' &&
                            item.role !== 'ORGANIZER' &&
                            (manage || item.userId === user!.id)
                          }
                          busy={destructive.isPending}
                          onRemove={() =>
                            request(
                              item.userId === user!.id
                                ? '¿Salir de este plan?'
                                : '¿Retirar del grupo?',
                              item.userId === user!.id
                                ? 'Dejarás de ver este plan. Podrás volver a unirte con una invitación.'
                                : `${item.userName} dejará de participar y sus respuestas se eliminarán.`,
                              'Confirmar',
                              () => api.removeParticipant(planId, item.userId),
                              item.userId === user!.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </DataSection>
                {commitments.isError && (
                  <ErrorState error={commitments.error} retry={() => void commitments.refetch()} />
                )}
              </>
            )}
            {tab === 'availability' && (
              <>
                <h2>Encuentren un momento en común</h2>
                <p>Las horas se muestran en hora de Lima.</p>
                {contribute && <AvailabilityForm planId={planId} />}
                <DataSection query={availability}>
                  {(items) =>
                    items.length ? (
                      <div className="availability-list">
                        {items.map((item) => (
                          <div className="availability-row" key={item.id}>
                            <CalendarDays size={20} />
                            <div>
                              <strong>{item.userName}</strong>
                              <p>
                                {formatDate(item.availableDate)} ·{' '}
                                {item.startTime
                                  ? item.startTime.slice(0, 5) + '–' + item.endTime?.slice(0, 5)
                                  : 'Todo el día'}
                              </p>
                            </div>
                            {contribute && item.userId === user!.id && (
                              <Button
                                variant="quiet"
                                aria-label="Eliminar mi disponibilidad"
                                onClick={() =>
                                  request(
                                    '¿Eliminar disponibilidad?',
                                    'Este horario dejará de contar en la viabilidad.',
                                    'Eliminar',
                                    () => api.deleteAvailability(planId, item.id),
                                  )
                                }
                              >
                                <Trash2 size={17} />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="Un espacio en la agenda">
                        Comparte cuándo puedes y ayuden al grupo a decidir.
                      </EmptyState>
                    )
                  }
                </DataSection>
              </>
            )}
            {tab === 'map' && (
              <>
                <h2>Un punto para encontrarse</h2>
                <p>
                  El punto medio usa las ubicaciones de referencia del grupo. Es una orientación
                  geográfica; no calcula una ruta de encuentro.
                </p>
                <DataSection query={geography}>
                  {(geo) => (
                    <>
                      <p className="map-summary">
                        {geo.locatedParticipants} de {geo.joinedParticipants} integrantes tienen
                        ubicación. <Link to="/profile">Actualizar la mía</Link>
                      </p>
                      {points.length ? (
                        <MapView points={points} />
                      ) : (
                        <EmptyState title="El mapa está esperando sus ideas">
                          Añadan ubicaciones de referencia o propongan un lugar para empezar.
                        </EmptyState>
                      )}
                    </>
                  )}
                </DataSection>
              </>
            )}
          </section>
        </div>
        <aside className="detail-aside">
          <section className="decision-panel">
            <h2>¿Sale o no sale?</h2>
            <DataSection query={feasibility}>
              {(value) => <FeasibilityIndicator value={value} />}
            </DataSection>
            {contribute ? (
              <>
                <h3>¿Cuentan contigo?</h3>
                <div className="commitment-buttons">
                  {(['CONFIRMED', 'INTERESTED', 'CANT_GO'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={ownCommitment?.status === status ? 'primary' : 'secondary'}
                      busy={respond.isPending && respond.variables === status}
                      disabled={respond.isPending}
                      aria-pressed={ownCommitment?.status === status}
                      onClick={() => respond.mutate(status)}
                    >
                      {status === 'CONFIRMED' ? 'Sí, voy' : commitmentLabels[status]}
                    </Button>
                  ))}
                </div>
                <Field
                  label="Una nota para tu grupo (opcional)"
                  maxLength={500}
                  value={note ?? ownCommitment?.note ?? ''}
                  onChange={(event) => setNote(event.target.value)}
                  hint="Se guarda al elegir tu respuesta."
                />
                {ownCommitment?.note && (
                  <p className="saved-note">Tu nota guardada: {ownCommitment.note}</p>
                )}
              </>
            ) : (
              <p>
                {plan.status === 'CLOSED'
                  ? 'Este plan ya está confirmado. Las propuestas elegidas están marcadas en la lista.'
                  : plan.status === 'CANCELLED'
                    ? 'El plan se canceló. Puedes consultar lo que organizaron.'
                    : 'Acepta la invitación para responder si vas.'}
              </p>
            )}
            {manage && (
              <div className="organizer-actions">
                <h3>Para quien organiza</h3>
                <Button
                  disabled={feasibility.data?.status !== 'READY_TO_CLOSE'}
                  onClick={() =>
                    request(
                      '¿Confirmar el plan?',
                      'Se elegirán las propuestas más votadas de fecha y lugar, y el grupo recibirá una notificación. Ya no podrán cambiar las respuestas.',
                      'Confirmar plan',
                      () => api.closePlan(planId),
                    )
                  }
                >
                  Confirmar y cerrar plan
                </Button>
                <small>Puedes confirmar cuando el plan esté listo para cerrar.</small>
                <Button
                  variant="quiet"
                  onClick={() =>
                    request(
                      '¿Cancelar este plan?',
                      'El grupo recibirá un aviso. El plan seguirá disponible para consultar.',
                      'Cancelar plan',
                      () => api.cancelPlan(planId),
                    )
                  }
                >
                  Cancelar plan
                </Button>
              </div>
            )}
          </section>
          {(plan.currentUserRole === 'ORGANIZER' || user?.role === 'ADMIN') && (
            <Button
              className="delete-plan"
              variant="quiet"
              onClick={() =>
                request(
                  '¿Eliminar este plan definitivamente?',
                  'Se borrarán el plan, las propuestas, los votos y las respuestas. Esta acción no se puede deshacer.',
                  'Eliminar definitivamente',
                  () => api.deletePlan(planId),
                  true,
                )
              }
            >
              <Trash2 size={16} />
              Eliminar plan
            </Button>
          )}
        </aside>
      </div>
      {share && (
        <Dialog title="El plan empieza por invitar" onClose={() => setShare(false)}>
          <p>
            Comparte el enlace o el código. Para entrar al grupo necesitarán su cuenta de QSale.
          </p>
          <div className="share-code">
            <QRCodeSVG value={link} size={180} title="Código QR para unirse al plan" />
            <strong>{plan.inviteCode}</strong>
          </div>
          <Field label="Enlace de invitación" readOnly value={link} />
          <div className="actions end">
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(plan.inviteCode)
                  .then(() => toast('Código copiado.'))
                  .catch(() => toast('Selecciona el código y cópialo manualmente.', true))
              }
            >
              <Copy size={17} />
              Copiar código
            </Button>
            <Button
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast('Enlace copiado.'))
                  .catch(() => toast('Selecciona el enlace y cópialo manualmente.', true))
              }
            >
              <Copy size={17} />
              Copiar enlace
            </Button>
          </div>
        </Dialog>
      )}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          busy={destructive.isPending}
          onConfirm={() => destructive.mutate(undefined)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

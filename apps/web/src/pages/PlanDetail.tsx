import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Copy,
  Pencil,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  canContribute,
  attendanceSummary,
  canRespond,
  isOrganizer,
  formatOptionDate,
  canManagePlan,
  commitmentLabels,
  displayName,
  formatDate,
  formatMoney,
  googleCalendarUrl,
  planTypeLabels,
  tentativeText,
  type CommitmentStatus,
  type PlanOption,
} from '@qsale/contracts';
import { DateRecommendations, ReschedulePanel } from '../Coordination';
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
  StatusBadge,
  useToast,
} from '../ui';
import { MapView, type MapPoint } from '../Map';
import { DataSection, ParticipantRow, OptionCard } from './PlanDetailCards';
import { OptionForm, AvailabilityForm } from './PlanDetailForms';
export { ParticipantRow, OptionCard } from './PlanDetailCards';
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
    refetchInterval: 8000,
    enabled: valid,
  });
  const enabled = Boolean(query.data);
  const participants = useQuery({
    queryKey: ['participants', planId],
    queryFn: ({ signal }) => api.participants(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const commitments = useQuery({
    queryKey: ['commitments', planId],
    queryFn: ({ signal }) => api.commitments(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const feasibility = useQuery({
    queryKey: ['feasibility', planId],
    queryFn: ({ signal }) => api.feasibility(planId, signal),
    refetchInterval: 8000,
    enabled,
  });
  const options = useQuery({
    queryKey: ['options', planId],
    queryFn: ({ signal }) => api.options(planId, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((option) => option.estimateStatus === 'PENDING') ? 4000 : 8000,
  });
  const availability = useQuery({
    queryKey: ['availabilities', planId],
    queryFn: ({ signal }) => api.availabilities(planId, signal),
    refetchInterval: 8000,
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
    (status: CommitmentStatus) => api.respond(planId, status, note ?? undefined),
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
  if (query.isError)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const plan = query.data;
  const manage = canManagePlan(plan, user);
  const contribute = canContribute(plan);
  const respondable = canRespond(plan);
  const organizer = isOrganizer(plan, user);
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
          {tentativeText(plan)}
        </span>
        <span>
          <Wallet size={17} />
          {formatMoney(plan.budget)} estimados
        </span>
        <span>
          <UsersRound size={17} />
          Mínimo {plan.minParticipants}
        </span>
        <span>Por {displayName(plan.creatorName, plan.creatorNickname)}</span>
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
      {plan.status === 'CLOSED' && (
        <section className="inline-form" aria-label="Acuerdo vigente">
          <h2>Acuerdo vigente</h2>
          {options.data
            ?.filter((option) => option.selected)
            .map((option) => (
              <p key={option.id}>
                <strong>
                  {option.type === 'DATE' ? formatOptionDate(option) : option.label}
                </strong>
              </p>
            ))}
          {plan.agreedAddress && <p>{plan.agreedAddress}</p>}
          {googleCalendarUrl(plan) && (
            <p>
              <a
                className="button secondary"
                href={googleCalendarUrl(plan)!}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarDays size={18} />
                Agregar a Google Calendar
              </a>
            </p>
          )}
          <p>
            Si alguien no puede asistir, el día y el lugar se conservan. Solo quien organiza
            puede aplicar una reprogramación aprobada o reabrir el plan.
          </p>
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
                <ReschedulePanel plan={plan} options={options.data ?? []} />
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
                            commitments.data?.find(
                              (response) => response.userId === item.userId,
                            )?.status
                          }
                          note={
                            commitments.data?.find(
                              (response) => response.userId === item.userId,
                            )?.note
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
                                : `${displayName(item.userName, item.userNickname)} dejará de participar y sus respuestas se eliminarán.`,
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
                  <ErrorState
                    error={commitments.error}
                    retry={() => void commitments.refetch()}
                  />
                )}
              </>
            )}
            {tab === 'availability' && (
              <>
                <h2>Encuentren un momento en común</h2>
                <p>Las horas se muestran en hora de Lima.</p>
                {respondable && <AvailabilityForm planId={planId} />}
                <DateRecommendations planId={planId} />
                <DataSection query={availability}>
                  {(items) =>
                    items.length ? (
                      <div className="availability-list">
                        {items.map((item) => (
                          <div className="availability-row" key={item.id}>
                            <CalendarDays size={20} />
                            <div>
                              <strong>{displayName(item.userName, item.userNickname)}</strong>
                              <p>
                                {formatDate(item.availableDate)} ·{' '}
                                {item.startTime
                                  ? item.startTime.slice(0, 5) + '–' + item.endTime?.slice(0, 5)
                                  : 'Todo el día'}
                              </p>
                            </div>
                            {respondable && item.userId === user!.id && (
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
                  geográfica; no calcula una ruta de encuentro. Aparece cuando al menos dos
                  integrantes guardan una ubicación.
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
              {(value) =>
                plan.status === 'CLOSED' ? (
                  <div role="status">
                    <strong>
                      {attendanceSummary(value.confirmedParticipants, value.minParticipants)}
                    </strong>
                    <p>
                      {value.confirmedParticipants < value.minParticipants
                        ? 'Ya no se alcanza el mínimo. El acuerdo se conserva; quien organiza puede reabrirlo o cancelarlo.'
                        : 'El acuerdo sigue vigente.'}
                    </p>
                  </div>
                ) : plan.status === 'CANCELLED' ? (
                  <p>Plan cancelado; disponible para consulta.</p>
                ) : (
                  <>
                    <FeasibilityIndicator value={value} />
                    {!value.dateReady && <p>Falta una fecha vigente con votos.</p>}
                    {!value.placeReady && <p>Falta un lugar con votos.</p>}
                  </>
                )
              }
            </DataSection>
            {respondable ? (
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
            {organizer && plan.status === 'CLOSED' && (
              <div className="organizer-actions">
                <h3>Para quien organiza</h3>
                <Button
                  variant="secondary"
                  disabled={destructive.isPending}
                  onClick={() =>
                    request(
                      '¿Reabrir el plan?',
                      'Se conservarán las opciones y los votos, pero las asistencias confirmadas pasarán a pendientes para decidir un nuevo acuerdo. Las propuestas de reprogramación activas quedarán reemplazadas.',
                      'Reabrir plan',
                      () => api.reopenPlan(planId),
                    )
                  }
                >
                  Reabrir para decidir de nuevo
                </Button>
                <Button
                  variant="quiet"
                  disabled={destructive.isPending}
                  onClick={() =>
                    request(
                      '¿Cancelar este plan?',
                      'El grupo recibirá un aviso y conservará el historial.',
                      'Cancelar plan',
                      () => api.cancelPlan(planId),
                    )
                  }
                >
                  Cancelar plan
                </Button>
              </div>
            )}
            {manage && (
              <div className="organizer-actions">
                <h3>Para quien organiza</h3>
                <Button
                  disabled={feasibility.data?.status !== 'READY_TO_CLOSE'}
                  onClick={() =>
                    request(
                      '¿Confirmar el plan?',
                      'Se fijarán el día y el lugar más votados. La hora es opcional. Cada integrante podrá actualizar su asistencia sin cambiar el acuerdo.',
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

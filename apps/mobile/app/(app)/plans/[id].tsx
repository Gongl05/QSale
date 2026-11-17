import { useState, type ReactNode } from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import {
  canContribute,
  attendanceSummary,
  canRespond,
  isOrganizer,
  formatOptionDate,
  canManagePlan,
  commitmentLabels,
  displayName,
  feasibilityLabels,
  formatDate,
  formatMoney,
  planStatusLabels,
  tentativeText,
  type CommitmentStatus,
  type PlanOption,
} from '@qsale/contracts';
import { DateRecommendations, ReschedulePanel } from '../../../src/Coordination';
import { api, useSession } from '../../../src/session';
import { MapView, openInMaps, type MapPoint } from '../../../src/Map';
import { Avatar } from '../../../src/Avatar';
import { OriginPicker } from '../../../src/OriginPicker';
import { SaleStamp, useConfirmedHaptic } from '../../../src/SaleStamp';
import { addPlanToCalendar, calendarTimes } from '../../../src/addToCalendar';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Loading,
  Screen,
  Tabs,
  Text,
  colors,
  confirmAction,
  styles,
  useAction,
  useToast,
} from '../../../src/ui';
function Section<T>({
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
  children: (data: T) => ReactNode;
}) {
  return query.isPending ? (
    <Loading />
  ) : query.isError ? (
    <ErrorState error={query.error!} retry={() => void query.refetch()} />
  ) : (
    <>{children(query.data!)}</>
  );
}
import { AvailabilityForm } from '../../../src/AvailabilityForm';
export default function PlanDetail() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const planId = Number(id);
  const router = useRouter();
  const { user } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('proposals'),
    [sharing, setSharing] = useState(false),
    [email, setEmail] = useState(''),
    [note, setNote] = useState<string | null>(null);
  const valid = Number.isSafeInteger(planId) && planId > 0;
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
      query.state.data?.some((item) => item.estimateStatus === 'PENDING') ? 4000 : 8000,
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
  useConfirmedHaptic(query.data?.status);
  const accept = useAction(() => api.acceptInvitation(planId), 'Ya eres parte del grupo.');
  const vote = useAction(
    (option: PlanOption) => (option.hasVoted ? api.removeVote(option.id) : api.vote(option.id)),
    'Voto actualizado.',
  );
  const invite = useAction(
    (email: string) => api.invite(planId, email),
    'Invitación enviada.',
    () => setEmail(''),
  );
  const respond = useAction(
    (status: CommitmentStatus) => api.respond(planId, status, note ?? undefined),
    'Tu respuesta está guardada.',
    () => setNote(null),
  );
  const change = useAction((action: () => Promise<unknown>) => action(), 'Cambio realizado.');
  if (!valid)
    return (
      <Screen>
        <ErrorState error={new Error('El enlace del plan no es válido.')} />
      </Screen>
    );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Screen>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </Screen>
    );
  const plan = query.data,
    manage = canManagePlan(plan, user),
    contribute = canContribute(plan),
    respondable = canRespond(plan),
    organizer = isOrganizer(plan, user),
    mine = commitments.data?.find((item) => item.userId === user!.id);
  const link =
    (process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'qsale:/') +
    '/join/' +
    plan.inviteCode;
  const request = (
    title: string,
    description: string,
    action: () => Promise<unknown>,
    leave = false,
  ) =>
    confirmAction(title, description, () =>
      change.mutate(action, {
        onSuccess: () => {
          if (leave) router.dismissTo('/');
        },
      }),
    );
  const points: MapPoint[] = (options.data ?? [])
    .filter((option) => option.type === 'PLACE' && option.location)
    .map((option) => ({ ...option.location!, label: option.label }));
  if (geography.data?.midpoint)
    points.push({ ...geography.data.midpoint, label: 'Punto medio del grupo', midpoint: true });
  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() =>
        void Promise.all([
          query.refetch(),
          participants.refetch(),
          commitments.refetch(),
          feasibility.refetch(),
          options.refetch(),
          availability.refetch(),
          geography.refetch(),
        ])
      }
    >
      <Heading title={plan.name} description={plan.description ?? undefined} />
      <View style={styles.row}>
        <Badge good={plan.status === 'CLOSED'}>{planStatusLabels[plan.status]}</Badge>
        <Text style={styles.muted}>Por {displayName(plan.creatorName, plan.creatorNickname)}</Text>
      </View>
      <Text style={styles.subtitle}>
        {tentativeText(plan)} · {formatMoney(plan.budget)} estimados · Mínimo{' '}
        {plan.minParticipants}
      </Text>
      <View style={styles.row}>
        {plan.status === 'OPEN' && (
          <Button variant="secondary" icon="share-2" onPress={() => setSharing(!sharing)}>
            Compartir
          </Button>
        )}
        {manage && (
          <Button
            variant="secondary"
            icon="edit-2"
            onPress={() => router.push(('/plans/' + planId + '/edit') as '/plans/[id]/edit')}
          >
            Editar
          </Button>
        )}
      </View>
      {sharing && (
        <View style={[styles.surface, { alignItems: 'center' }]}>
          <Text style={styles.subheading}>El plan empieza por invitar</Text>
          <QRCode value={link} size={180} />
          <Text selectable style={styles.code}>
            {plan.inviteCode}
          </Text>
          <Text selectable style={styles.muted}>
            {link}
          </Text>
          <Button
            icon="share-2"
            onPress={() =>
              void Share.share({
                message: `Únete a “${plan.name}” en QSale. Código: ${plan.inviteCode}\n${link}`,
              }).catch(() => toast('No pudimos abrir las opciones para compartir.', true))
            }
          >
            Compartir invitación
          </Button>
        </View>
      )}
      {plan.currentUserParticipationStatus === 'INVITED' && plan.status === 'OPEN' && (
        <View style={styles.note}>
          <Text style={styles.subheading}>Te invitaron a este plan</Text>
          <Text style={[styles.subtitle, { marginVertical: 12 }]}>
            Únete para proponer, votar y responder si vas.
          </Text>
          <Button busy={accept.isPending} onPress={() => accept.mutate(undefined)}>
            Aceptar invitación
          </Button>
        </View>
      )}
      {plan.status === 'CLOSED' && (
        <View style={styles.surface}>
          <View style={styles.between}>
            <Text style={styles.heading}>Acuerdo vigente</Text>
            <SaleStamp />
          </View>
          {options.data
            ?.filter((option) => option.selected)
            .map((option) => (
              <Text style={styles.subheading} key={option.id}>
                {option.type === 'DATE' ? formatOptionDate(option) : option.label}
              </Text>
            ))}
          {plan.agreedAddress ? <Text style={styles.muted}>{plan.agreedAddress}</Text> : null}
          {calendarTimes(plan) && (
            <Button
              variant="secondary"
              icon="calendar"
              onPress={() =>
                void addPlanToCalendar(plan).catch(() =>
                  toast('No pudimos abrir tu calendario.', true),
                )
              }
            >
              Agregar a mi calendario
            </Button>
          )}
          <Text>
            Si alguien no puede asistir, el día y el lugar se conservan. Solo quien organiza
            puede aplicar una reprogramación aprobada o reabrir el plan.
          </Text>
        </View>
      )}
      <View style={styles.surface}>
        <Text style={styles.heading}>¿Sale o no sale?</Text>
        <Section query={feasibility}>
          {(value) =>
            plan.status === 'CLOSED' ? (
              <>
                <Text style={styles.subheading}>
                  {attendanceSummary(value.confirmedParticipants, value.minParticipants)}
                </Text>
                <Text>
                  {value.confirmedParticipants < value.minParticipants
                    ? 'Ya no se alcanza el mínimo. El acuerdo se conserva; quien organiza puede reabrirlo o cancelarlo.'
                    : 'El acuerdo sigue vigente.'}
                </Text>
              </>
            ) : plan.status === 'CANCELLED' ? (
              <Text>Plan cancelado; disponible para consulta.</Text>
            ) : (
              <>
                <Badge good={value.status === 'READY_TO_CLOSE'}>
                  {feasibilityLabels[value.status]}
                </Badge>
                <Text style={styles.subtitle}>
                  {value.confirmedParticipants} de {value.minParticipants} confirmaciones
                  mínimas · Viabilidad {value.score}%
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: value.score }}
                  style={{
                    height: 6,
                    borderRadius: 4,
                    backgroundColor: '#EEE7DA',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${value.score}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
                <Text style={styles.muted}>
                  La viabilidad también considera propuestas, votos y disponibilidad.
                </Text>
                {!value.dateReady && <Text>Falta una fecha vigente con votos.</Text>}
                {!value.placeReady && <Text>Falta un lugar con votos.</Text>}
              </>
            )
          }
        </Section>
        {respondable ? (
          <>
            <Text style={styles.subheading}>¿Cuentan contigo?</Text>
            <View style={{ gap: 9 }}>
              {(['CONFIRMED', 'INTERESTED', 'CANT_GO'] as const).map((status) => (
                <Button
                  key={status}
                  variant={mine?.status === status ? 'primary' : 'secondary'}
                  disabled={respond.isPending}
                  busy={respond.isPending && respond.variables === status}
                  onPress={() => respond.mutate(status)}
                >
                  {status === 'CONFIRMED' ? 'Sí, voy' : commitmentLabels[status]}
                </Button>
              ))}
            </View>
            <Field
              label="Una nota para tu grupo (opcional)"
              maxLength={500}
              value={note ?? mine?.note ?? ''}
              onChangeText={setNote}
              hint="Se guarda al elegir tu respuesta."
            />
            {Boolean(mine?.note) && (
              <Text style={styles.muted}>Tu nota guardada: {mine?.note}</Text>
            )}
          </>
        ) : (
          <Text style={styles.subtitle}>
            {plan.status === 'CLOSED'
              ? 'Este plan ya está confirmado. Las propuestas elegidas están marcadas abajo.'
              : plan.status === 'CANCELLED'
                ? 'El plan se canceló. Puedes consultar lo que organizaron.'
                : 'Acepta la invitación para responder si vas.'}
          </Text>
        )}
      </View>
      <Tabs
        items={
          [
            ['proposals', 'Propuestas'],
            ['group', 'El grupo'],
            ['availability', 'Disponibilidad'],
            ['map', 'Mapa'],
          ] as const
        }
        value={tab}
        onChange={setTab}
      />
      {tab === 'proposals' && (
        <>
          <Heading
            title="¿Cuándo y dónde?"
            description="Elijan juntos. Puedes votar por más de una propuesta."
          />
          {contribute && (
            <Button
              variant="secondary"
              icon="plus"
              onPress={() =>
                router.push(('/plans/' + planId + '/proposal') as '/plans/[id]/proposal')
              }
            >
              Proponer
            </Button>
          )}
          <ReschedulePanel plan={plan} options={options.data ?? []} />
          <Section query={options}>
            {(items) =>
              items.length ? (
                items.map((option) => (
                  <View
                    style={[styles.option, option.selected && { borderColor: '#6A9E88' }]}
                    key={option.id}
                  >
                    <View style={styles.between}>
                      <Text style={[styles.subheading, { flex: 1 }]}>{option.label}</Text>
                      {option.selected && <Badge good>Elegida</Badge>}
                    </View>
                    {Boolean(option.description) && (
                      <Text style={styles.subtitle}>{option.description}</Text>
                    )}
                    <Text>
                      {option.type === 'DATE'
                        ? formatOptionDate(option)
                        : option.location?.address || 'Lugar marcado en el mapa'}
                    </Text>
                    {option.type === 'PLACE' && option.location && (
                      <Button
                        variant="quiet"
                        icon="map-pin"
                        onPress={() => openInMaps(option.location!, option.label)}
                      >
                        Ver dónde queda
                      </Button>
                    )}
                    {option.type === 'PLACE' && (
                      <Text style={styles.muted}>
                        {option.estimateStatus === 'PENDING'
                          ? 'Calculando estimación…'
                          : option.estimateStatus === 'READY'
                            ? `Promedio del grupo: ${option.avgDistanceKm?.toFixed(1)} km · ${Math.round(option.avgTravelMinutes ?? 0)} min. ${option.estimateSource === 'ROUTING' ? 'Estimación de rutas' : option.estimateSource === 'HAVERSINE' ? 'Aproximación en línea recta; no es una ruta de tránsito' : 'Origen de estimación no disponible'}`
                            : 'Sin estimación: aún faltan ubicaciones del grupo.'}
                      </Text>
                    )}
                    <Text style={styles.muted}>
                      {option.voteCount} {option.voteCount === 1 ? 'voto' : 'votos'} · Por{' '}
                      {displayName(option.proposedByName, option.proposedByNickname)}
                    </Text>
                    <View style={styles.row}>
                      {contribute && (
                        <Button
                          icon="thumbs-up"
                          variant={option.hasVoted ? 'primary' : 'secondary'}
                          busy={vote.isPending && vote.variables?.id === option.id}
                          disabled={vote.isPending}
                          onPress={() => vote.mutate(option)}
                        >
                          {option.hasVoted ? 'Quitar mi voto' : 'Votar'}
                        </Button>
                      )}
                      {manage && (
                        <Button
                          variant="quiet"
                          icon="trash-2"
                          disabled={change.isPending}
                          onPress={() =>
                            request(
                              '¿Eliminar propuesta?',
                              `Se eliminarán “${option.label}” y sus votos.`,
                              () => api.deleteOption(planId, option.id),
                            )
                          }
                        >
                          Eliminar
                        </Button>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState title="Las mejores ideas empiezan con alguien">
                  Propongan una fecha o un lugar para que el grupo vote.
                </EmptyState>
              )
            }
          </Section>
        </>
      )}
      {tab === 'group' && (
        <>
          <Heading
            title="La gente que hace el plan"
            description="Unirse al grupo y confirmar asistencia son pasos distintos."
          />
          {manage && (
            <View style={styles.surface}>
              <Field
                label="Invitar por correo"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                maxLength={150}
              />
              <Button
                busy={invite.isPending}
                icon="user-plus"
                onPress={() => {
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                    toast('Escribe un correo válido.', true);
                    return;
                  }
                  invite.mutate(email.trim());
                }}
              >
                Enviar invitación
              </Button>
            </View>
          )}
          <Section query={participants}>
            {(items) =>
              items.map((item) => (
                <View style={styles.surface} key={item.id}>
                  <View style={styles.row}>
                    <Avatar
                      userId={item.userId}
                      version={item.userAvatarVersion}
                      name={item.userName}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subheading}>
                        {displayName(item.userName, item.userNickname)}
                      </Text>
                      {item.userNickname ? (
                        <Text style={styles.muted}>{item.userName}</Text>
                      ) : null}
                      <Text style={styles.muted}>
                        {item.role === 'ORGANIZER'
                          ? 'Organiza el plan'
                          : item.status === 'INVITED'
                            ? 'Invitación pendiente'
                            : 'Parte del grupo'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.subtitle}>
                    {item.status === 'INVITED'
                      ? 'Aún no se une'
                      : commitments.data?.find((response) => response.userId === item.userId)
                        ? commitmentLabels[
                            commitments.data.find(
                              (response) => response.userId === item.userId,
                            )!.status
                          ]
                        : 'Sin respuesta'}
                  </Text>
                  {Boolean(
                    commitments.data?.find((response) => response.userId === item.userId)?.note,
                  ) && (
                    <Text style={styles.muted}>
                      Nota:{' '}
                      {
                        commitments.data?.find((response) => response.userId === item.userId)
                          ?.note
                      }
                    </Text>
                  )}
                  {plan.status === 'OPEN' &&
                    item.role !== 'ORGANIZER' &&
                    (manage || item.userId === user!.id) && (
                      <Button
                        variant="quiet"
                        busy={change.isPending}
                        onPress={() =>
                          request(
                            item.userId === user!.id
                              ? '¿Salir de este plan?'
                              : '¿Retirar del grupo?',
                            'Se eliminará su participación y sus respuestas.',
                            () => api.removeParticipant(planId, item.userId),
                            item.userId === user!.id,
                          )
                        }
                      >
                        {item.userId === user!.id ? 'Salir del plan' : 'Retirar del grupo'}
                      </Button>
                    )}
                </View>
              ))
            }
          </Section>
          {commitments.isError && (
            <ErrorState error={commitments.error} retry={() => void commitments.refetch()} />
          )}
        </>
      )}
      {tab === 'availability' && (
        <>
          <Heading
            title="Encuentren un momento en común"
            description="La disponibilidad ayuda a la viabilidad; no sustituye tu confirmación de asistencia."
          />
          {respondable && <AvailabilityForm planId={planId} />}
          <DateRecommendations planId={planId} />
          <Section query={availability}>
            {(items) =>
              items.length ? (
                items.map((item) => (
                  <View style={styles.surface} key={item.id}>
                    <Text style={styles.subheading}>
                      {displayName(item.userName, item.userNickname)}
                    </Text>
                    <Text>
                      {formatDate(item.availableDate)} ·{' '}
                      {item.startTime
                        ? item.startTime.slice(0, 5) + '–' + item.endTime?.slice(0, 5)
                        : 'Todo el día'}
                    </Text>
                    {respondable && item.userId === user!.id && (
                      <Button
                        variant="quiet"
                        disabled={change.isPending}
                        onPress={() =>
                          request(
                            '¿Eliminar disponibilidad?',
                            'Este horario dejará de contar en la viabilidad.',
                            () => api.deleteAvailability(planId, item.id),
                          )
                        }
                      >
                        Eliminar mi disponibilidad
                      </Button>
                    )}
                  </View>
                ))
              ) : (
                <EmptyState title="Un espacio en la agenda">
                  Comparte cuándo puedes y ayuden al grupo a decidir.
                </EmptyState>
              )
            }
          </Section>
        </>
      )}
      {tab === 'map' && (
        <>
          <Heading
            title="Un punto para encontrarse"
            description="El punto medio aparece con las ubicaciones de al menos dos integrantes. Orienta geográficamente; no calcula una ruta de encuentro."
          />
          <Section query={geography}>
            {(geo) => (
              <>
                <Text style={styles.subtitle}>
                  {geo.locatedParticipants} de {geo.joinedParticipants} integrantes tienen
                  ubicación.
                </Text>
                {points.length ? (
                  <MapView points={points} />
                ) : (
                  <EmptyState title="El mapa espera sus ideas">
                    Añadan ubicaciones de referencia o propongan un lugar para empezar.
                  </EmptyState>
                )}
                <OriginPicker plan={plan} />
              </>
            )}
          </Section>
        </>
      )}
      {organizer && plan.status === 'CLOSED' && (
        <View style={styles.surface}>
          <Text style={styles.subheading}>Para quien organiza</Text>
          <Button
            variant="secondary"
            disabled={change.isPending}
            onPress={() =>
              request(
                '¿Reabrir el plan?',
                'Se conservarán las opciones y los votos, pero las asistencias confirmadas pasarán a pendientes para decidir un nuevo acuerdo. Las reprogramaciones activas quedarán reemplazadas.',
                () => api.reopenPlan(planId),
              )
            }
          >
            Reabrir para decidir de nuevo
          </Button>
          <Button
            variant="quiet"
            disabled={change.isPending}
            onPress={() =>
              request(
                '¿Cancelar este plan?',
                'El grupo recibirá un aviso y conservará el historial.',
                () => api.cancelPlan(planId),
              )
            }
          >
            Cancelar plan
          </Button>
        </View>
      )}
      {manage && (
        <View style={styles.surface}>
          <Text style={styles.subheading}>Para quien organiza</Text>
          <Button
            busy={change.isPending}
            disabled={feasibility.data?.status !== 'READY_TO_CLOSE'}
            onPress={() =>
              request(
                '¿Confirmar el plan?',
                'Se fijarán el día y el lugar más votados. La hora es opcional. Cada integrante podrá actualizar su asistencia sin cambiar el acuerdo.',
                () => api.closePlan(planId),
              )
            }
          >
            Confirmar y cerrar plan
          </Button>
          <Text style={styles.muted}>
            Disponible cuando la viabilidad indica “Listo para cerrar”.
          </Text>
          <Button
            variant="quiet"
            disabled={change.isPending}
            onPress={() =>
              request(
                '¿Cancelar este plan?',
                'El grupo recibirá un aviso. El plan seguirá disponible para consultar.',
                () => api.cancelPlan(planId),
              )
            }
          >
            Cancelar plan
          </Button>
        </View>
      )}
      {(plan.currentUserRole === 'ORGANIZER' || user!.role === 'ADMIN') && (
        <Button
          variant="quiet"
          icon="trash-2"
          disabled={change.isPending}
          onPress={() =>
            request(
              '¿Eliminar definitivamente?',
              'Se borrarán el plan, propuestas, votos y respuestas. Esta acción no se puede deshacer.',
              () => api.deletePlan(planId),
              true,
            )
          }
        >
          Eliminar plan
        </Button>
      )}
    </Screen>
  );
}

import { PlanOptionCard } from '../../../src/PlanOptionCard';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Section } from '../../../src/PlanDetailSection';
import { PlanAttendancePanel } from '../../../src/PlanAttendancePanel';
import { PlanManagementActions } from '../../../src/PlanManagementActions';
import { usePlanData } from '../../../src/usePlanData';
import QRCode from 'react-native-qrcode-svg';
import {
  canContribute,
  canRespond,
  formatOptionDate,
  canManagePlan,
  commitmentLabels,
  formatDate,
  formatMoney,
  planStatusLabels,
  type PlanOption,
} from '@qsale/contracts';
import { DateRecommendations, ReschedulePanel } from '../../../src/Coordination';
import { api, useSession } from '../../../src/session';
import { MapView, type MapPoint } from '../../../src/Map';
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
  confirmAction,
  styles,
  useAction,
  useToast,
} from '../../../src/ui';
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
    [email, setEmail] = useState('');
  const valid = Number.isSafeInteger(planId) && planId > 0;
  const {
    query,
    participants,
    commitments,
    feasibility,
    options,
    availability,
    geography,
    refresh,
  } = usePlanData(planId);
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
    mine = commitments.data?.find((item) => item.userId === user!.id);
  const link =
    (process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'qsale:/') + '/join/' + plan.inviteCode;
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
    points.push({
      ...geography.data.midpoint,
      label: 'Punto medio del grupo',
      midpoint: true,
    });
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void refresh()}>
      <Heading title={plan.name} description={plan.description ?? undefined} />
      <View style={styles.row}>
        <Badge good={plan.status === 'CLOSED'}>{planStatusLabels[plan.status]}</Badge>
        <Text style={styles.muted}>Por {plan.creatorName}</Text>
      </View>
      <Text style={styles.subtitle}>
        {formatDate(plan.tentativeStartDate)} · {formatMoney(plan.budget)} estimados · Mínimo{' '}
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
          <Text style={styles.heading}>Acuerdo vigente</Text>
          {options.data
            ?.filter((option) => option.selected)
            .map((option) => (
              <Text style={styles.subheading} key={option.id}>
                {option.type === 'DATE' ? formatOptionDate(option) : option.label}
              </Text>
            ))}
          <Text>
            Si alguien no puede asistir, el día y el lugar se conservan. Solo quien organiza puede
            aplicar una reprogramación aprobada o reabrir el plan.
          </Text>
        </View>
      )}
      <PlanAttendancePanel key={plan.id} plan={plan} feasibility={feasibility} mine={mine} />
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
                  <PlanOptionCard
                    key={option.id}
                    option={option}
                    contribute={contribute}
                    manage={manage}
                    vote={vote}
                    busy={change.isPending}
                    planId={planId}
                    request={request}
                  />
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
                    <View style={styles.avatar}>
                      <Text
                        style={{
                          fontFamily: 'Manrope_800ExtraBold',
                          color: '#8B431D',
                        }}
                      >
                        {item.userName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subheading}>{item.userName}</Text>
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
                            commitments.data.find((response) => response.userId === item.userId)!
                              .status
                          ]
                        : 'Sin respuesta'}
                  </Text>
                  {Boolean(
                    commitments.data?.find((response) => response.userId === item.userId)?.note,
                  ) && (
                    <Text style={styles.muted}>
                      Nota:{' '}
                      {commitments.data?.find((response) => response.userId === item.userId)?.note}
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
                    <Text style={styles.subheading}>{item.userName}</Text>
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
                <Button variant="secondary" onPress={() => router.push('/profile')}>
                  Actualizar mi ubicación
                </Button>
              </>
            )}
          </Section>
        </>
      )}
      <PlanManagementActions
        plan={plan}
        feasibility={feasibility}
        busy={change.isPending}
        request={request}
      />
    </Screen>
  );
}

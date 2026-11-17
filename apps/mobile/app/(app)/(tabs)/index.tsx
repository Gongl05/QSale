import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import {
  agreedDay,
  displayName,
  planProgressLabel,
  tentativeText,
  formatDate,
  formatMoney,
  planStatusLabels,
  planTypeLabels,
  type PlanStatus,
} from '@qsale/contracts';
import { api } from '../../../src/session';
import { planThemes } from '../../../src/planTheme';
import { MemberFaces } from '../../../src/MemberFaces';
import { useDebounced, usePagination } from '../../../src/hooks';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Loading,
  Pagination,
  Screen,
  Tabs,
  Text,
  colors,
  styles,
} from '../../../src/ui';

export default function Plans() {
  const router = useRouter();
  const pager = usePagination();
  const [search, setSearch] = useState(pager.params.search ?? '');
  const debounced = useDebounced(search);
  const status = pager.params.status ?? '';
  const sort = pager.params.sort || 'createdAt,desc';
  useEffect(() => {
    if (debounced !== (pager.params.search ?? '')) pager.update({ search: debounced, page: '1' });
  }, [debounced]);
  const filters = {
    page: pager.page,
    size: pager.size,
    search: pager.params.search || undefined,
    status: ['OPEN', 'CLOSED', 'CANCELLED'].includes(status) ? (status as PlanStatus) : undefined,
    sort,
  };
  const query = useQuery({
    queryKey: ['plans', filters],
    queryFn: ({ signal }) => api.plans(filters, signal),
  });
  useEffect(() => {
    if (query.data && pager.page > 0 && !query.data.content.length)
      pager.onChange(Math.max(0, query.data.totalPages - 1), pager.size);
  }, [query.data]);
  return (
    <Screen
      safeBottom={false}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Heading
        title="Hagamos que salga."
        description="Tus ideas, tu gente y el próximo plan para recordar."
      />
      <View style={styles.row}>
        <Button icon="plus" onPress={() => router.push('/plans/new')}>
          Crear plan
        </Button>
        <Button variant="secondary" icon="camera" onPress={() => router.push('/join')}>
          Tengo un código
        </Button>
      </View>
      <Field
        label="Buscar planes"
        placeholder="Busca ese plan…"
        value={search}
        onChangeText={setSearch}
        maxLength={200}
      />
      <Tabs
        items={
          [
            ['', 'Todos'],
            ['OPEN', 'Abiertos'],
            ['CLOSED', 'Confirmados'],
            ['CANCELLED', 'Cancelados'],
          ] as const
        }
        value={status}
        onChange={(value) => pager.update({ status: value, page: '1' })}
      />
      <Text style={styles.label}>Ordenar por</Text>
      <Tabs
        items={
          [
            ['createdAt,desc', 'Recientes'],
            ['name,asc', 'Nombre'],
            ['tentativeStartDate,asc', 'Fecha'],
            ['feasibilityScore,desc', 'Viabilidad'],
            ['budget,asc', 'Presupuesto'],
          ] as const
        }
        value={sort}
        onChange={(value) => pager.update({ sort: value, page: '1' })}
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.content.length ? (
        <EmptyState
          title={
            search || status ? 'Ningún plan coincide todavía' : 'Tu próximo buen plan empieza aquí'
          }
        >
          {search || status
            ? 'Prueba otro nombre o cambia los filtros.'
            : 'Propón algo, invita a tu grupo y decidan juntos.'}
        </EmptyState>
      ) : (
        query.data.content.map((plan) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Ver ' + plan.name}
            key={plan.id}
            style={styles.planCard}
            onPress={() => router.push(('/plans/' + plan.id) as '/plans/[id]')}
          >
            <View
              style={[styles.planStrip, { backgroundColor: planThemes[plan.type].background }]}
            >
              <Text
                style={{
                  color: planThemes[plan.type].color,
                  fontSize: 13,
                  fontFamily: 'Manrope_800ExtraBold',
                }}
              >
                {planTypeLabels[plan.type]}
              </Text>
              <Feather name={planThemes[plan.type].icon} size={30} color={planThemes[plan.type].color} />
            </View>
            <View style={styles.planBody}>
              <View style={styles.row}>
                <Badge good={plan.status === 'CLOSED'}>{planStatusLabels[plan.status]}</Badge>
                {plan.currentUserParticipationStatus === 'INVITED' && <Badge>Te invitaron</Badge>}
              </View>
              <Text style={styles.heading}>{plan.name}</Text>
              <Text style={styles.muted}>
                {plan.currentUserRole === 'ORGANIZER'
                  ? 'Organizado por ti'
                  : 'Por ' + displayName(plan.creatorName, plan.creatorNickname)}
              </Text>
              <View style={styles.statRow}>
                <Feather name="calendar" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13, flex: 1 }}>
                  {agreedDay(plan)
                    ? 'Acordado: ' + formatDate(agreedDay(plan))
                    : tentativeText(plan)}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="credit-card" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13 }}>
                  Presupuesto estimado: {formatMoney(plan.budget)}
                </Text>
              </View>
              <MemberFaces members={plan.members ?? []} joinedCount={plan.joinedCount ?? 0} />
              <View style={styles.statRow}>
                <Feather name="users" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13 }}>Mínimo {plan.minParticipants} personas</Text>
              </View>
              <View style={styles.divider} />
              <Text
                style={{
                  fontSize: 12,
                  color: plan.feasibilityStatus === 'READY_TO_CLOSE' ? colors.green : '#7C4B12',
                  fontFamily: 'Manrope_700Bold',
                }}
              >
                {planProgressLabel(plan)}
              </Text>
            </View>
          </Pressable>
        ))
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
    </Screen>
  );
}

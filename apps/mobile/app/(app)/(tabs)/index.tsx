import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import {
  feasibilityLabels,
  formatDate,
  formatMoney,
  planStatusLabels,
  planTypeLabels,
  type PlanStatus,
} from '@qsale/contracts';
import { api } from '../../../src/session';
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
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
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
            <View style={styles.planStrip}>
              <Text style={{ color: '#8B4215', fontSize: 12, fontFamily: 'Manrope_700Bold' }}>
                {planTypeLabels[plan.type]}
              </Text>
              <Feather name="calendar" size={33} color="#8B4215" />
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
                  : 'Por ' + plan.creatorName}
              </Text>
              <View style={styles.statRow}>
                <Feather name="calendar" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13 }}>{formatDate(plan.tentativeStartDate)}</Text>
              </View>
              <View style={styles.statRow}>
                <Feather name="credit-card" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13 }}>
                  Presupuesto estimado: {formatMoney(plan.budget)}
                </Text>
              </View>
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
                {feasibilityLabels[plan.feasibilityStatus]}
              </Text>
            </View>
          </Pressable>
        ))
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
    </Screen>
  );
}

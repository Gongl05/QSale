import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import {
  agreedDay,
  formatDate,
  planStatusLabels,
  tentativeText,
  todayInLima,
  type Plan,
} from '@qsale/contracts';
import { api } from '../../../src/session';
import { MonthGrid } from '../../../src/Calendar';
import { addPlanToCalendar } from '../../../src/addToCalendar';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Screen,
  Text,
  colors,
  styles,
  useToast,
} from '../../../src/ui';

const agreedColor = colors.green;
const tentativeColor = colors.orange;

/** Every day between two yyyy-mm-dd dates, both included (capped to avoid runaway ranges). */
function daysBetween(start: string, end: string) {
  const days: string[] = [];
  let current = new Date(start + 'T12:00:00Z');
  const last = new Date(end + 'T12:00:00Z');
  while (current <= last && days.length < 62) {
    days.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 86_400_000);
  }
  return days;
}

/** The days a plan occupies: the agreed date when confirmed, otherwise its tentative dates. */
function planDays(plan: Plan): { days: string[]; agreed: boolean } {
  const agreed = agreedDay(plan);
  if (agreed) {
    const end = plan.agreedEndsOn ?? plan.agreedEndsAt?.slice(0, 10) ?? agreed;
    return { days: daysBetween(agreed, end), agreed: true };
  }
  if (plan.tentativeDates?.length) return { days: plan.tentativeDates, agreed: false };
  if (plan.tentativeStartDate)
    return {
      days: daysBetween(plan.tentativeStartDate, plan.tentativeEndDate ?? plan.tentativeStartDate),
      agreed: false,
    };
  return { days: [], agreed: false };
}

export default function CalendarTab() {
  const router = useRouter();
  const toast = useToast();
  const today = todayInLima();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const query = useQuery({
    queryKey: ['plans', 'calendar'],
    queryFn: ({ signal }) => api.plans({ page: 0, size: 100, sort: 'createdAt,desc' }, signal),
  });
  const byDay = useMemo(() => {
    const map = new Map<string, { plan: Plan; agreed: boolean }[]>();
    for (const plan of query.data?.content ?? []) {
      if (plan.status === 'CANCELLED') continue;
      const { days, agreed } = planDays(plan);
      for (const item of days) map.set(item, [...(map.get(item) ?? []), { plan, agreed }]);
    }
    return map;
  }, [query.data]);
  const selected = byDay.get(day) ?? [];

  return (
    <Screen
      safeBottom={false}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Heading
        title="Tu calendario"
        description="Los planes confirmados y las fechas que todavía se están decidiendo."
      />
      <View style={styles.surface}>
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          onPressDay={setDay}
          selected={(item) => item === day}
          marks={(item) =>
            (byDay.get(item) ?? []).map((entry) => ({
              color: entry.agreed ? agreedColor : tentativeColor,
            }))
          }
        />
        <View style={[styles.row, { gap: 16 }]}>
          <View style={styles.statRow}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: agreedColor }} />
            <Text style={styles.muted}>Confirmado</Text>
          </View>
          <View style={styles.statRow}>
            <View
              style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tentativeColor }}
            />
            <Text style={styles.muted}>Fecha tentativa</Text>
          </View>
        </View>
      </View>
      <Text style={styles.heading}>{formatDate(day)}</Text>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : selected.length ? (
        selected.map(({ plan, agreed }) => (
          <Pressable
            key={plan.id}
            accessibilityRole="button"
            accessibilityLabel={'Ver ' + plan.name}
            onPress={() => router.push(('/plans/' + plan.id) as '/plans/[id]')}
            style={styles.option}
          >
            <View style={styles.between}>
              <Text style={[styles.subheading, { flex: 1 }]}>{plan.name}</Text>
              <Badge good={agreed}>{agreed ? 'Confirmado' : planStatusLabels[plan.status]}</Badge>
            </View>
            <View style={styles.statRow}>
              <Feather name="calendar" size={15} color={colors.muted} />
              <Text style={{ fontSize: 13, flex: 1 }}>
                {agreed
                  ? plan.agreedStartsAt
                    ? formatDate(plan.agreedStartsAt, true)
                    : formatDate(agreedDay(plan))
                  : 'Tentativo: ' + tentativeText(plan)}
              </Text>
            </View>
            {agreed && plan.agreedPlace && (
              <View style={styles.statRow}>
                <Feather name="map-pin" size={15} color={colors.muted} />
                <Text style={{ fontSize: 13, flex: 1 }}>
                  {plan.agreedPlace + (plan.agreedAddress ? ' · ' + plan.agreedAddress : '')}
                </Text>
              </View>
            )}
            {agreed && (
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
          </Pressable>
        ))
      ) : (
        <EmptyState title="Día libre">
          No tienes planes confirmados ni fechas tentativas para este día.
        </EmptyState>
      )}
    </Screen>
  );
}

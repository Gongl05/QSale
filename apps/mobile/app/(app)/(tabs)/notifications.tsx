import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatDate } from '@qsale/contracts';
import { api } from '../../../src/session';
import { usePagination } from '../../../src/hooks';
import {
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Pagination,
  Screen,
  Tabs,
  Text,
  styles,
  useAction,
} from '../../../src/ui';
export default function Notifications() {
  const router = useRouter();
  const pager = usePagination();
  const unreadOnly = pager.params.unread === 'true';
  const filters = { page: pager.page, size: pager.size, unreadOnly };
  const query = useQuery({
    queryKey: ['notifications', filters],
    queryFn: ({ signal }) => api.notifications(filters, signal),
  });
  const read = useAction((id: number) => api.markRead(id), 'Notificación marcada como leída.');
  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Heading
        title="Lo último de tu grupo"
        description={
          query.data
            ? query.data.unreadCount + ' notificaciones sin leer'
            : 'Invitaciones, cambios y planes que ya salieron.'
        }
      />
      <Tabs
        items={
          [
            ['all', 'Todas'],
            ['unread', 'Sin leer'],
          ] as const
        }
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(value) => pager.update({ unread: String(value === 'unread'), page: '1' })}
      />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.content.length ? (
        query.data.content.map((item) => (
          <View
            key={item.id}
            style={[styles.surface, !item.readAt && { backgroundColor: '#FFF7E9' }]}
          >
            <Text>{item.message}</Text>
            <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
            <View style={styles.row}>
              {item.planId && (
                <Button
                  variant="secondary"
                  onPress={() => router.push(('/plans/' + item.planId) as '/plans/[id]')}
                >
                  Ver plan
                </Button>
              )}
              {!item.readAt && (
                <Button
                  variant="quiet"
                  busy={read.isPending && read.variables === item.id}
                  onPress={() => read.mutate(item.id)}
                >
                  Marcar leída
                </Button>
              )}
            </View>
          </View>
        ))
      ) : (
        <EmptyState title="Todo al día">Las novedades de tus planes aparecerán aquí.</EmptyState>
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
    </Screen>
  );
}

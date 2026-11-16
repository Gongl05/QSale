import { View } from 'react-native';
import { formatOptionDate, type PlanOption } from '@qsale/contracts';
import { api } from './session';
import type { PlanActionRequest } from './PlanManagementActions';
import { Badge, Button, Text, styles } from './ui';
export function PlanOptionCard({
  option,
  contribute,
  manage,
  vote,
  busy,
  planId,
  request,
}: {
  option: PlanOption;
  contribute: boolean;
  manage: boolean;
  busy: boolean;
  planId: number;
  request: PlanActionRequest;
  vote: { isPending: boolean; variables?: PlanOption; mutate: (option: PlanOption) => void };
}) {
  return (
    <View style={[styles.option, option.selected && { borderColor: '#6A9E88' }]}>
      <View style={styles.between}>
        <Text style={[styles.subheading, { flex: 1 }]}>{option.label}</Text>
        {option.selected && <Badge good>Elegida</Badge>}
      </View>
      {Boolean(option.description) && <Text style={styles.subtitle}>{option.description}</Text>}
      <Text>
        {option.type === 'DATE'
          ? formatOptionDate(option)
          : (option.location?.address ?? 'Ubicación en el mapa')}
      </Text>
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
        {option.voteCount} {option.voteCount === 1 ? 'voto' : 'votos'} · Por {option.proposedByName}
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
            disabled={busy}
            onPress={() =>
              request('¿Eliminar propuesta?', `Se eliminarán “${option.label}” y sus votos.`, () =>
                api.deleteOption(planId, option.id),
              )
            }
          >
            Eliminar
          </Button>
        )}
      </View>
    </View>
  );
}

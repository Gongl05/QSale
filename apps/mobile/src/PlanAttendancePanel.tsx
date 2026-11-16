import { useState } from 'react';
import { View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  attendanceSummary,
  canRespond,
  commitmentLabels,
  feasibilityLabels,
  type PlanDetail,
  type Commitment,
  type CommitmentStatus,
  type Feasibility,
} from '@qsale/contracts';
import { api } from './session';
import { Section } from './PlanDetailSection';
import { Badge, Button, Field, Text, colors, styles, useAction } from './ui';
export function PlanAttendancePanel({
  plan,
  feasibility,
  mine,
}: {
  plan: PlanDetail;
  feasibility: UseQueryResult<Feasibility, Error>;
  mine?: Commitment;
}) {
  const [note, setNote] = useState<string | null>(null);
  const respondable = canRespond(plan);
  const respond = useAction(
    (status: CommitmentStatus) => api.respond(plan.id, status, note ?? undefined),
    'Tu respuesta está guardada.',
    () => setNote(null),
  );
  return (
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
                {value.confirmedParticipants} de {value.minParticipants} confirmaciones mínimas ·
                Viabilidad {value.score}%
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
          {Boolean(mine?.note) && <Text style={styles.muted}>Tu nota guardada: {mine?.note}</Text>}
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
  );
}

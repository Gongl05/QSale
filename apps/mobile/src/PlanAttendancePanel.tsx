import { useEffect, useState } from "react";
import { View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  canRespond,
  commitmentLabels,
  type PlanDetail,
  type Commitment,
  type CommitmentStatus,
  type Feasibility,
} from "@qsale/contracts";
import { api } from "./session";
import { Section } from "./PlanDetailSection";
import {
  Button,
  Choice,
  Disclosure,
  Field,
  Text,
  useUI,
  useAction,
} from "./ui";
import { useUnsavedChanges } from "./useUnsavedChanges";

export function PlanAttendancePanel({
  plan,
  feasibility,
  mine,
}: {
  plan: PlanDetail;
  feasibility: UseQueryResult<Feasibility, Error>;
  mine?: Commitment;
}) {
  const { styles, colors } = useUI();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<CommitmentStatus>(
    mine?.status ?? "CONFIRMED",
  );
  const [note, setNote] = useState(mine?.note ?? "");
  const dirty =
    editing && (status !== mine?.status || note !== (mine?.note ?? ""));
  const respond = useAction(
    () => api.respond(plan.id, status, note),
    "Tu respuesta está guardada",
    () => setEditing(false),
  );
  useUnsavedChanges(dirty && !respond.isPending);
  useEffect(() => {
    if (!editing) {
      setStatus(mine?.status ?? "CONFIRMED");
      setNote(mine?.note ?? "");
    }
  }, [mine?.status, mine?.note, editing]);
  return (
    <View style={styles.surface}>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>Tu asistencia</Text>
          <Text
            style={[
              styles.subheading,
              {
                color: mine?.status === "CONFIRMED" ? colors.green : colors.ink,
              },
            ]}
          >
            {mine ? commitmentLabels[mine.status] : "Sin respuesta"}
          </Text>
        </View>
        {canRespond(plan) && !editing && (
          <Button
            variant={mine ? "secondary" : "primary"}
            onPress={() => setEditing(true)}
          >
            {mine ? "Cambiar respuesta" : "Responder"}
          </Button>
        )}
      </View>
      {!editing && Boolean(mine?.note) && (
        <Text style={styles.subtitle}>{mine?.note}</Text>
      )}
      {editing && (
        <View style={{ gap: 16 }}>
          <Choice
            items={
              [
                ["CONFIRMED", "Sí, voy"],
                ["INTERESTED", "Me interesa"],
                ["CANT_GO", "No puedo"],
              ] as const
            }
            value={status}
            onChange={setStatus}
          />
          <Field
            label="Nota para el grupo (opcional)"
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />
          <View style={styles.row}>
            <Button
              busy={respond.isPending}
              onPress={() => respond.mutate(undefined)}
            >
              Guardar respuesta
            </Button>
            <Button
              variant="quiet"
              disabled={respond.isPending}
              onPress={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </View>
        </View>
      )}
      <Section query={feasibility}>
        {(value) => (
          <View style={{ gap: 8 }}>
            <Text style={styles.subtitle}>
              {value.confirmedParticipants} de {value.minParticipants}{" "}
              confirmaciones mínimas
            </Text>
            {plan.status === "OPEN" ? (
              <Disclosure title="Qué falta para confirmar el plan">
                <Text style={styles.subtitle}>
                  {value.confirmedParticipants >= value.minParticipants
                    ? "Mínimo de asistentes alcanzado"
                    : `Faltan ${Math.max(0, value.minParticipants - value.confirmedParticipants)} confirmaciones`}
                </Text>
                <Text style={styles.subtitle}>
                  {value.dateReady
                    ? "Fecha con votos"
                    : "Falta una fecha vigente con votos"}
                </Text>
                <Text style={styles.subtitle}>
                  {value.placeReady
                    ? "Lugar con votos"
                    : "Falta un lugar con votos"}
                </Text>
                <Text style={styles.muted}>
                  Índice de coordinación: {value.score} %. También considera
                  propuestas, votos y disponibilidad; no es el porcentaje de
                  asistentes.
                </Text>
              </Disclosure>
            ) : (
              <Text style={styles.muted}>
                {plan.status === "CANCELLED"
                  ? "Plan cancelado; disponible para consulta."
                  : value.confirmedParticipants < value.minParticipants
                    ? "La asistencia bajó del mínimo. El acuerdo se conserva hasta que quien organiza lo cambie."
                    : "El acuerdo sigue vigente."}
              </Text>
            )}
          </View>
        )}
      </Section>
      {!canRespond(plan) && plan.status === "OPEN" && (
        <Text style={styles.subtitle}>
          Acepta la invitación para responder si vas.
        </Text>
      )}
    </View>
  );
}

import { useRef, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  canRespond,
  dateInputError,
  formatDate,
  isActiveReschedule,
  locationSchema,
  recommendationText,
  rescheduleLabels,
  rescheduleDateText,
  formatOptionDate,
  type Location,
  type PlanDetail,
  type PlanOption,
  type RescheduleInput,
} from "@qsale/contracts";
import { api } from "./session";
import { DateField } from "./DateField";
import { LocationPicker } from "./Map";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Text,
  confirmAction,
  useAction,
  useUI,
} from "./ui";

import { useUnsavedChanges } from "./useUnsavedChanges";

export function DateRecommendations({ planId }: { planId: number }) {
  const { colors, styles, dark } = useUI();
  const query = useQuery({
    queryKey: ["date-recommendations", planId],
    queryFn: ({ signal }) => api.dateRecommendations(planId, signal),
    refetchInterval: 8000,
  });
  return (
    <View style={styles.surface}>
      <Text style={styles.subheading}>Fechas que coinciden</Text>
      <Text style={styles.muted}>
        Se comparan las disponibilidades registradas. Son sugerencias: no
        cambian el acuerdo ni confirman asistencia. Puedes usar uno de estos
        días al crear una propuesta.
      </Text>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        query.data.map((item) => (
          <View key={item.date}>
            <Text style={styles.subheading}>{formatDate(item.date)}</Text>
            <Text>{recommendationText(item)}</Text>
          </View>
        ))
      ) : (
        <Text>
          Aún no hay días disponibles registrados desde hoy. Cada integrante
          puede añadir los suyos; es opcional.
        </Text>
      )}
    </View>
  );
}

function RescheduleForm({
  plan,
  options,
  onClose,
}: {
  plan: PlanDetail;
  options: PlanOption[];
  onClose: () => void;
}) {
  const { colors, styles, dark } = useUI();
  const currentDay = options.find(
    (item) => item.selected && item.type === "DATE",
  );
  const currentPlace = options.find(
    (item) => item.selected && item.type === "PLACE",
  );
  const [date, setDate] = useState(
    currentDay?.startsOn ?? currentDay?.startsAt?.slice(0, 10) ?? "",
  );
  const [time, setTime] = useState(currentDay?.startsAt?.slice(11, 16) ?? "");
  const [place, setPlace] = useState(String(currentPlace?.id ?? ""));
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const action = useAction(
    (data: RescheduleInput) => api.createReschedule(plan.id, data),
    "Propuesta publicada. Tu voto afirmativo ya está registrado.",
    onClose,
  );
  const draft = JSON.stringify([date, time, place, label, location, reason]);
  const initialDraft = useRef(draft);
  useUnsavedChanges(!action.isPending && draft !== initialDraft.current);
  return (
    <View style={styles.surface}>
      <Text style={styles.subheading}>Proponer una reprogramación</Text>
      <Text>
        El acuerdo actual sigue vigente. Al publicar, votas «Sí, asistiría si se
        aplica este cambio». Quien organiza decide si aplica una propuesta con
        mayoría y suficientes asistentes.
      </Text>
      {currentDay && (
        <Text>
          Acuerdo de partida: {formatOptionDate(currentDay)}. Si abarca varios
          días, se conserva su duración al mover el inicio. Para cambiar la
          duración, quien organiza puede reabrir el plan.
        </Text>
      )}
      <DateField
        label="Nuevo día"
        value={date}
        onChange={setDate}
        optional={false}
      />
      <DateField
        label="Nueva hora (Lima, opcional)"
        mode="time"
        value={time}
        onChange={setTime}
      />
      <Text style={styles.label}>Lugar propuesto</Text>
      {options
        .filter((item) => item.type === "PLACE" && item.location)
        .map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            selected={place === String(item.id)}
            onPress={() => setPlace(String(item.id))}
          >
            {item.label + (item.selected ? " (actual)" : "")}
          </Button>
        ))}
      <Button
        variant="secondary"
        selected={place === "new"}
        onPress={() => setPlace("new")}
      >
        Otro lugar
      </Button>
      {place === "new" && (
        <>
          <Field
            label="Nombre del nuevo lugar"
            maxLength={120}
            value={label}
            onChangeText={setLabel}
          />
          <LocationPicker value={location} onChange={setLocation} />
        </>
      )}
      <Field
        label="Motivo (opcional)"
        maxLength={500}
        value={reason}
        onChangeText={setReason}
      />
      <Text style={styles.muted}>
        La votación vence al llegar la hora propuesta o, si no la hay, al
        terminar ese día, hora de Lima. Si la mayoría rechaza el cambio, esta
        propuesta se cierra y el plan original continúa.
      </Text>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button variant="secondary" disabled={action.isPending} onPress={onClose}>
        Volver
      </Button>
      <Button
        busy={action.isPending}
        onPress={() => {
          const invalid = dateInputError(date, time);
          if (invalid) {
            setError(invalid);
            return;
          }
          if (
            place === "new" &&
            (label.trim().length < 3 ||
              !locationSchema.safeParse(location).success)
          ) {
            setError(
              "Pon un nombre de al menos 3 caracteres y una ubicación válida para el nuevo lugar.",
            );
            return;
          }
          if (!place) {
            setError("Elige un lugar.");
            return;
          }
          const oldDate =
            currentDay?.startsOn ?? currentDay?.startsAt?.slice(0, 10);
          if (
            date === oldDate &&
            time === (currentDay?.startsAt?.slice(11, 16) ?? "") &&
            place === String(currentPlace?.id)
          ) {
            setError(
              "Cambia el día, la hora o el lugar para proponer una alternativa.",
            );
            return;
          }
          setError("");
          action.mutate({
            date,
            ...(time ? { time } : {}),
            reason: reason.trim(),
            ...(place === "new"
              ? { placeLabel: label.trim(), location: location! }
              : { placeOptionId: Number(place) }),
          });
        }}
      >
        Publicar reprogramación
      </Button>
    </View>
  );
}

export function ReschedulePanel({
  plan,
  options,
}: {
  plan: PlanDetail;
  options: PlanOption[];
}) {
  const { colors, styles, dark } = useUI();
  const [form, setForm] = useState(false);
  const query = useQuery({
    queryKey: ["reschedules", plan.id],
    queryFn: ({ signal }) => api.reschedules(plan.id, signal),
    refetchInterval: plan.status === "CLOSED" ? 8000 : false,
  });
  const vote = useAction(
    ({ id, accepted }: { id: number; accepted: boolean }) =>
      api.voteReschedule(plan.id, id, accepted),
    "Voto de reprogramación guardado. El acuerdo actual no cambia.",
  );
  const change = useAction(
    (action: () => Promise<unknown>) => action(),
    "Propuesta actualizada.",
  );
  if (
    plan.status !== "CLOSED" &&
    !query.isPending &&
    !query.isError &&
    !query.data.length
  )
    return null;
  return (
    <View style={styles.surface}>
      <Text style={styles.heading}>Reprogramaciones</Text>
      <Text>
        Una baja de asistencia no obliga al resto a reconfirmar. Para cambiar el
        acuerdo, propongan una alternativa aquí.
      </Text>
      {plan.status === "CLOSED" && canRespond(plan) && !form && (
        <Button variant="secondary" onPress={() => setForm(true)}>
          Proponer reprogramación
        </Button>
      )}
      {form && plan.status === "CLOSED" && (
        <RescheduleForm
          plan={plan}
          options={options}
          onClose={() => setForm(false)}
        />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        query.data.map((item) => (
          <View style={styles.option} key={item.id}>
            <Text style={styles.subheading}>
              {rescheduleDateText(item)} · {item.placeLabel}
            </Text>
            <Badge good={item.status === "APPLIED"}>
              {rescheduleLabels[item.status]}
            </Badge>
            <Text>
              Por {item.createdByName}
              {item.reason ? " · " + item.reason : ""}
            </Text>
            <Text>
              {item.yesVotes} sí · {item.noVotes} no · {item.totalVoters}{" "}
              integrantes. Se necesitan {item.requiredVotes} votos afirmativos
              (mayoría y mínimo del plan).
            </Text>
            <Text>Vence: {formatDate(item.expiresAt, true)} (Lima)</Text>
            {item.myVote !== null && (
              <Text>
                Tu respuesta:{" "}
                {item.myVote
                  ? "Sí, asistiría si se aplica este cambio"
                  : "No me funciona este cambio"}
              </Text>
            )}
            {isActiveReschedule(item) && canRespond(plan) && (
              <>
                <Button
                  variant="secondary"
                  selected={item.myVote === true}
                  disabled={vote.isPending}
                  onPress={() => vote.mutate({ id: item.id, accepted: true })}
                >
                  Sí, asistiría con este cambio
                </Button>
                <Button
                  variant="secondary"
                  selected={item.myVote === false}
                  disabled={vote.isPending}
                  onPress={() => vote.mutate({ id: item.id, accepted: false })}
                >
                  No me funciona
                </Button>
              </>
            )}
            {item.canApply && (
              <Button
                disabled={change.isPending}
                onPress={() =>
                  confirmAction(
                    "¿Aplicar esta reprogramación?",
                    "Cambiarán el día y el lugar del acuerdo. Quienes votaron sí quedarán confirmados; quienes votaron no quedarán como no asistentes y quienes no votaron quedarán pendientes. Se avisará al grupo sin pedir otra confirmación a quienes ya dijeron sí.",
                    () =>
                      change.mutate(() =>
                        api.applyReschedule(plan.id, item.id),
                      ),
                  )
                }
              >
                Aplicar reprogramación
              </Button>
            )}
            {item.canWithdraw && (
              <Button
                variant="quiet"
                disabled={change.isPending}
                onPress={() =>
                  confirmAction(
                    "¿Retirar esta propuesta?",
                    "La votación terminará y el acuerdo actual seguirá vigente.",
                    () =>
                      change.mutate(() =>
                        api.withdrawReschedule(plan.id, item.id),
                      ),
                    "Retirar propuesta",
                    true,
                  )
                }
              >
                Retirar reprogramación
              </Button>
            )}
          </View>
        ))
      ) : (
        <EmptyState title="El acuerdo sigue vigente">
          No hay propuestas de reprogramación.
        </EmptyState>
      )}
    </View>
  );
}

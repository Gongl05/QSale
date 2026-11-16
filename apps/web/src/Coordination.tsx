import { useState } from "react";
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
import { useAction } from "./hooks";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
} from "./ui";
import { LocationPicker } from "./Map";
import { useUnsavedChanges } from "./useUnsavedChanges";

export function DateRecommendations({ planId }: { planId: number }) {
  const query = useQuery({
    queryKey: ["date-recommendations", planId],
    queryFn: ({ signal }) => api.dateRecommendations(planId, signal),
    refetchInterval: 8000,
  });
  return (
    <section className="date-recommendations" aria-label="Fechas recomendadas">
      <h3>Fechas que coinciden</h3>
      <p>
        Se comparan las disponibilidades registradas. Son sugerencias: no
        cambian el acuerdo ni confirman asistencia. Puedes usar uno de estos
        días al crear una propuesta.
      </p>
      {query.isPending ? (
        <Skeleton rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        query.data.map((item) => (
          <p key={item.date}>
            <strong>{formatDate(item.date)}</strong>
            <br />
            {recommendationText(item)}
          </p>
        ))
      ) : (
        <p>
          Aún no hay días disponibles registrados desde hoy. Cada integrante
          puede añadir los suyos; es opcional.
        </p>
      )}
    </section>
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
  const guard = useUnsavedChanges(
    date !==
      (currentDay?.startsOn ?? currentDay?.startsAt?.slice(0, 10) ?? "") ||
      time !== (currentDay?.startsAt?.slice(11, 16) ?? "") ||
      place !== String(currentPlace?.id ?? "") ||
      Boolean(label || location || reason),
  );
  const action = useAction(
    (data: RescheduleInput) => api.createReschedule(plan.id, data),
    "Propuesta publicada. Tu voto afirmativo ya está registrado.",
    () => {
      guard.allowNavigation();
      onClose();
    },
  );
  return (
    <form
      className="inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
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
      <h3>Proponer una reprogramación</h3>
      <p>
        El acuerdo actual sigue vigente. Al publicar, votas «Sí, asistiría si se
        aplica este cambio». Quien organiza decide si aplica una propuesta con
        mayoría y suficientes asistentes.
      </p>
      {currentDay && (
        <p>
          Acuerdo de partida: {formatOptionDate(currentDay)}. Si abarca varios
          días, se conserva su duración al mover el inicio. Para cambiar la
          duración, quien organiza puede reabrir el plan.
        </p>
      )}
      <Field
        label="Nuevo día"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <Field
        label="Nueva hora (Lima, opcional)"
        type="time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      <label className="field">
        <span>Lugar propuesto</span>
        <select
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          aria-label="Lugar propuesto"
        >
          <option value="">Elige un lugar</option>
          {options
            .filter((item) => item.type === "PLACE" && item.location)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.selected ? " (actual)" : ""}
              </option>
            ))}
          <option value="new">Otro lugar</option>
        </select>
      </label>
      {place === "new" && (
        <>
          <Field
            label="Nombre del nuevo lugar"
            maxLength={120}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <LocationPicker value={location} onChange={setLocation} />
        </>
      )}
      <Field
        label="Motivo (opcional)"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <p className="form-hint">
        La votación vence al llegar la hora propuesta o, si no la hay, al
        terminar ese día, hora de Lima. Si la mayoría rechaza el cambio, se
        cierra esta propuesta y el plan original continúa.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions end">
        <Button
          type="button"
          variant="secondary"
          disabled={action.isPending}
          onClick={() => guard.confirmDiscard(onClose)}
        >
          Cancelar propuesta
        </Button>
        <Button busy={action.isPending}>Publicar reprogramación</Button>
      </div>
      {guard.dialog}
    </form>
  );
}

export function ReschedulePanel({
  plan,
  options,
}: {
  plan: PlanDetail;
  options: PlanOption[];
}) {
  const [form, setForm] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: string;
    run: () => Promise<unknown>;
    intent?: "default" | "danger";
  } | null>(null);
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
    () => confirm!.run(),
    "Propuesta actualizada.",
    () => setConfirm(null),
  );
  if (
    plan.status !== "CLOSED" &&
    !query.isPending &&
    !query.isError &&
    !query.data.length
  )
    return null;
  return (
    <section className="inline-form" aria-label="Reprogramaciones">
      <h2>Reprogramaciones</h2>
      <p>
        Una baja de asistencia no obliga al resto a reconfirmar. Para cambiar el
        acuerdo, propongan una alternativa aquí.
      </p>
      {plan.status === "CLOSED" && canRespond(plan) && !form && (
        <Button variant="secondary" onClick={() => setForm(true)}>
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
        <Skeleton rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        query.data.map((item) => (
          <article
            className="option-card"
            key={item.id}
            aria-label={"Reprogramación " + item.date}
          >
            <h3>
              {rescheduleDateText(item)} · {item.placeLabel}
            </h3>
            <strong>{rescheduleLabels[item.status]}</strong>
            <p>
              Por {item.createdByName}
              {item.reason ? " · " + item.reason : ""}
            </p>
            <p>
              {item.yesVotes} sí · {item.noVotes} no · {item.totalVoters}{" "}
              integrantes. Se necesitan {item.requiredVotes} votos afirmativos
              (mayoría y mínimo del plan).
            </p>
            <p>Vence: {formatDate(item.expiresAt, true)} (Lima)</p>
            {item.myVote !== null && (
              <p>
                Tu respuesta:{" "}
                {item.myVote
                  ? "Sí, asistiría si se aplica este cambio"
                  : "No me funciona este cambio"}
              </p>
            )}
            {isActiveReschedule(item) && canRespond(plan) && (
              <div className="actions">
                <Button
                  variant="secondary"
                  className={item.myVote === true ? "is-selected" : ""}
                  aria-pressed={item.myVote === true}
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ id: item.id, accepted: true })}
                >
                  Sí, asistiría con este cambio
                </Button>
                <Button
                  variant="secondary"
                  className={item.myVote === false ? "is-selected" : ""}
                  aria-pressed={item.myVote === false}
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ id: item.id, accepted: false })}
                >
                  No me funciona
                </Button>
              </div>
            )}
            {item.canApply && (
              <Button
                disabled={change.isPending}
                onClick={() =>
                  setConfirm({
                    title: "¿Aplicar esta reprogramación?",
                    description:
                      "Cambiarán el día y el lugar del acuerdo. Quienes votaron sí quedarán confirmados; quienes votaron no quedarán como no asistentes y quienes no votaron quedarán pendientes. Se avisará al grupo sin pedir otra confirmación a quienes ya dijeron sí.",
                    action: "Aplicar cambio",
                    run: () => api.applyReschedule(plan.id, item.id),
                  })
                }
              >
                Aplicar reprogramación
              </Button>
            )}
            {item.canWithdraw && (
              <Button
                variant="quiet"
                disabled={change.isPending}
                onClick={() =>
                  setConfirm({
                    title: "¿Retirar esta propuesta?",
                    description:
                      "La votación terminará y el acuerdo actual seguirá vigente.",
                    action: "Retirar propuesta",
                    intent: "danger",
                    run: () => api.withdrawReschedule(plan.id, item.id),
                  })
                }
              >
                Retirar reprogramación
              </Button>
            )}
          </article>
        ))
      ) : (
        <EmptyState title="El acuerdo sigue vigente">
          No hay propuestas de reprogramación.
        </EmptyState>
      )}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          busy={change.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => change.mutate(undefined)}
        />
      )}
    </section>
  );
}

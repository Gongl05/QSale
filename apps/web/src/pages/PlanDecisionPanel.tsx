import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Check, Circle, Pencil, Trash2 } from "lucide-react";
import {
  canManagePlan,
  canRespond,
  isOrganizer,
  attendanceSummary,
  commitmentLabels,
  formatDate,
  type Commitment,
  type CommitmentStatus,
  type Feasibility,
  type PlanDetail,
} from "@qsale/contracts";
import { api, useSession } from "../session";
import { useAction } from "../hooks";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { Button, Field } from "../ui";
import { DataSection } from "./PlanDetailCards";

export type PlanActionRequest = (
  title: string,
  description: string,
  action: string,
  run: () => Promise<unknown>,
  leave?: boolean,
  intent?: "default" | "danger",
) => void;

export function PlanDecisionPanel({
  plan,
  feasibility,
  commitment,
  busy,
  request,
}: {
  plan: PlanDetail;
  feasibility: UseQueryResult<Feasibility, Error>;
  commitment?: Commitment;
  busy: boolean;
  request: PlanActionRequest;
}) {
  const { user } = useSession();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<CommitmentStatus | undefined>(
    commitment?.status,
  );
  const [note, setNote] = useState(commitment?.note ?? "");
  const [error, setError] = useState("");
  const dirty =
    editing &&
    (status !== commitment?.status || note !== (commitment?.note ?? ""));
  const guard = useUnsavedChanges(dirty);
  useEffect(() => {
    if (!editing) {
      setStatus(commitment?.status);
      setNote(commitment?.note ?? "");
    }
  }, [commitment?.status, commitment?.note, editing]);
  const respond = useAction(
    ({ status, note }: { status: CommitmentStatus; note: string }) =>
      api.respond(plan.id, status, note),
    "Tu respuesta está guardada",
    () => {
      setEditing(false);
      setError("");
    },
  );
  const manage = canManagePlan(plan, user);
  const organizer = isOrganizer(plan, user);
  const preview = plan.closingPreview;
  const previewText = preview
    ? [
        preview.date ? formatDate(preview.date) : null,
        preview.time ? `${preview.time.slice(0, 5)} (Lima)` : null,
        preview.place,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Se fijarán el día vigente y el lugar más votados según el orden del grupo.";
  return (
    <aside className="detail-aside">
      <section
        className="decision-panel"
        aria-label="Asistencia y estado del plan"
      >
        <div className="attendance-summary">
          <div>
            <h2>Tu asistencia</h2>
            <p className="own-response" role="status">
              {commitment
                ? commitment.status === "CONFIRMED"
                  ? "Sí, voy"
                  : commitmentLabels[commitment.status]
                : "Todavía no respondes"}
            </p>
            {commitment?.note && !editing && (
              <p className="saved-note">{commitment.note}</p>
            )}
          </div>
          {canRespond(plan) && !editing && (
            <Button
              variant={commitment ? "secondary" : "primary"}
              onClick={() => setEditing(true)}
            >
              {commitment && <Pencil size={16} />}
              {commitment ? "Editar respuesta" : "Responder si voy"}
            </Button>
          )}
        </div>
        {editing && canRespond(plan) && (
          <form
            className="attendance-editor"
            onSubmit={(event) => {
              event.preventDefault();
              if (!status) {
                setError("Elige una respuesta antes de guardar.");
                return;
              }
              setError("");
              respond.mutate({ status, note: note.trim() });
            }}
          >
            <fieldset className="response-options">
              <legend>¿Cuentan contigo?</legend>
              {(["CONFIRMED", "INTERESTED", "CANT_GO"] as const).map(
                (value) => (
                  <label
                    key={value}
                    className={status === value ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name={"attendance-" + plan.id}
                      value={value}
                      checked={status === value}
                      onChange={() => setStatus(value)}
                      disabled={respond.isPending}
                    />
                    {value === "CONFIRMED"
                      ? "Sí, voy"
                      : commitmentLabels[value]}
                  </label>
                ),
              )}
            </fieldset>
            <Field
              label="Una nota para tu grupo (opcional)"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              hint="Tu respuesta y tu nota se guardan juntas."
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {respond.isError && (
              <p role="alert" className="form-error">
                {respond.error.message}
              </p>
            )}
            <div className="actions">
              <Button type="submit" busy={respond.isPending}>
                Guardar respuesta
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={respond.isPending}
                onClick={() => guard.confirmDiscard(() => setEditing(false))}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {!canRespond(plan) && (
          <p>
            {plan.status === "CANCELLED"
              ? "Plan cancelado; puedes consultar el historial."
              : "Acepta la invitación para responder si vas."}
          </p>
        )}
        <DataSection query={feasibility}>
          {(value) => (
            <div className="plan-readiness">
              <h3>
                {plan.status === "CLOSED"
                  ? "Asistencia del grupo"
                  : "Para confirmar el plan"}
              </h3>
              <p>
                {attendanceSummary(
                  value.confirmedParticipants,
                  value.minParticipants,
                )}
              </p>
              {plan.status === "CLOSED" ? (
                <p>
                  {value.confirmedParticipants < value.minParticipants
                    ? "Faltan asistentes para alcanzar el mínimo. El acuerdo se conserva."
                    : "El acuerdo sigue vigente."}
                </p>
              ) : plan.status === "OPEN" ? (
                <ul className="readiness-list">
                  {[
                    [
                      value.confirmedParticipants >= value.minParticipants,
                      value.confirmedParticipants >= value.minParticipants
                        ? "Mínimo de asistentes alcanzado"
                        : `Faltan ${Math.max(0, value.minParticipants - value.confirmedParticipants)} confirmaciones`,
                    ],
                    [
                      value.dateReady,
                      value.dateReady
                        ? "Fecha vigente con votos"
                        : "Falta una fecha vigente con votos",
                    ],
                    [
                      value.placeReady,
                      value.placeReady
                        ? "Lugar con votos"
                        : "Falta un lugar con votos",
                    ],
                  ].map(([ready, label]) => (
                    <li key={String(label)}>
                      {ready ? (
                        <Check size={16} aria-label="Completado" />
                      ) : (
                        <Circle size={16} aria-label="Pendiente" />
                      )}
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </DataSection>
        {(manage || (organizer && plan.status === "CLOSED")) && (
          <details className="organizer-actions">
            <summary>Gestionar el plan</summary>
            {manage ? (
              <>
                {preview && (
                  <div className="closing-preview">
                    <h3>Acuerdo que se confirmará</h3>
                    <p>{previewText}</p>
                  </div>
                )}
                <Button
                  disabled={
                    busy || feasibility.data?.status !== "READY_TO_CLOSE"
                  }
                  onClick={() =>
                    request(
                      "Confirmar el plan",
                      `${previewText} Cada integrante podrá actualizar su asistencia sin cambiar este acuerdo.`,
                      "Confirmar plan",
                      () => api.closePlan(plan.id),
                    )
                  }
                >
                  Confirmar y cerrar plan
                </Button>
                {feasibility.data?.status !== "READY_TO_CLOSE" && (
                  <p className="form-hint">
                    Completa los requisitos del grupo para confirmar el acuerdo.
                  </p>
                )}
              </>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  request(
                    "¿Reabrir el plan?",
                    "Se conservarán las opciones y los votos, pero las asistencias confirmadas pasarán a pendientes. Las propuestas de reprogramación activas quedarán reemplazadas.",
                    "Reabrir plan",
                    () => api.reopenPlan(plan.id),
                    false,
                    "danger",
                  )
                }
              >
                Reabrir para decidir de nuevo
              </Button>
            )}
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() =>
                request(
                  "¿Cancelar este plan?",
                  "Se avisará al grupo. El plan y su historial seguirán disponibles para consultar.",
                  "Cancelar plan",
                  () => api.cancelPlan(plan.id),
                  false,
                  "danger",
                )
              }
            >
              Cancelar plan
            </Button>
          </details>
        )}
      </section>
      {(plan.currentUserRole === "ORGANIZER" || user?.role === "ADMIN") && (
        <details className="danger-zone">
          <summary>Eliminar plan</summary>
          <p>Se borrarán también propuestas, votos y respuestas.</p>
          <Button
            className="delete-plan"
            variant="quiet"
            onClick={() =>
              request(
                "¿Eliminar este plan definitivamente?",
                "Se borrarán el plan, las propuestas, los votos y las respuestas. Esta acción no se puede deshacer.",
                "Eliminar definitivamente",
                () => api.deletePlan(plan.id),
                true,
                "danger",
              )
            }
          >
            <Trash2 size={16} />
            Eliminar definitivamente
          </Button>
        </details>
      )}
      {guard.dialog}
    </aside>
  );
}

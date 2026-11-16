import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import {
  canManagePlan,
  type PlanDetail,
  type Participant,
  type Commitment,
} from "@qsale/contracts";
import { api, useSession } from "../session";
import { useAction } from "../hooks";
import { Button, Field, ErrorState } from "../ui";
import { DataSection, ParticipantRow } from "./PlanDetailCards";
import type { PlanActionRequest } from "./PlanDecisionPanel";
export function PlanGroupSection({
  plan,
  participants,
  commitments,
  busy,
  request,
  onShare,
}: {
  plan: PlanDetail;
  participants: UseQueryResult<Participant[], Error>;
  commitments: UseQueryResult<Commitment[], Error>;
  busy: boolean;
  request: PlanActionRequest;
  onShare: () => void;
}) {
  const { user } = useSession();
  const planId = plan.id;
  const manage = canManagePlan(plan, user);
  const [email, setEmail] = useState("");
  const invite = useAction(
    (email: string) => api.invite(planId, email),
    "Invitación enviada.",
    () => setEmail(""),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>El grupo</h2>
          <p>Unirse al grupo y confirmar asistencia son pasos distintos.</p>
        </div>
      </div>
      {manage && (
        <>
          <p className="form-hint">
            Invita por correo a alguien que ya tenga cuenta en QSale. Para
            personas nuevas,{" "}
            <button className="text-button" type="button" onClick={onShare}>
              comparte el enlace o el código
            </button>
            .
          </p>
          {manage && (
            <form
              className="invite-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (event.currentTarget.reportValidity())
                  invite.mutate(email.trim());
              }}
            >
              <Field
                label="Invitar por correo"
                type="email"
                required
                value={email}
                maxLength={150}
                placeholder="alguien@correo.com"
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button busy={invite.isPending}>
                <UserPlus size={18} />
                Invitar
              </Button>
            </form>
          )}
        </>
      )}
      <DataSection query={participants}>
        {(items) => (
          <div className="participant-list">
            {items.map((item) => (
              <ParticipantRow
                key={item.id}
                item={item}
                commitment={
                  commitments.data?.find(
                    (response) => response.userId === item.userId,
                  )?.status
                }
                note={
                  commitments.data?.find(
                    (response) => response.userId === item.userId,
                  )?.note
                }
                canRemove={
                  plan.status === "OPEN" &&
                  item.role !== "ORGANIZER" &&
                  (manage || item.userId === user!.id)
                }
                busy={busy}
                onRemove={() =>
                  request(
                    item.userId === user!.id
                      ? "¿Salir de este plan?"
                      : "¿Retirar del grupo?",
                    item.userId === user!.id
                      ? "Dejarás de ver este plan. Podrás volver a unirte con una invitación."
                      : `${item.userName} dejará de participar y sus respuestas se eliminarán.`,
                    item.userId === user!.id
                      ? "Salir del plan"
                      : "Retirar del grupo",
                    () => api.removeParticipant(planId, item.userId),
                    item.userId === user!.id,
                    "danger",
                  )
                }
              />
            ))}
          </div>
        )}
      </DataSection>
      {commitments.isError && (
        <ErrorState
          error={commitments.error}
          retry={() => void commitments.refetch()}
        />
      )}
    </>
  );
}

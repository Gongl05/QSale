import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  canContribute,
  canManagePlan,
  type PlanDetail,
  type PlanOption,
  type Geography,
} from "@qsale/contracts";
import { ReschedulePanel } from "../Coordination";
import { api, useSession } from "../session";
import { useAction } from "../hooks";
import { Button, EmptyState } from "../ui";
import { DataSection, OptionCard } from "./PlanDetailCards";
import { OptionForm } from "./PlanDetailForms";
import type { PlanActionRequest } from "./PlanDecisionPanel";
export function PlanProposalsSection({
  plan,
  options,
  geography,
  request,
}: {
  plan: PlanDetail;
  options: UseQueryResult<PlanOption[], Error>;
  geography?: Geography;
  request: PlanActionRequest;
}) {
  const { user } = useSession();
  const planId = plan.id;
  const manage = canManagePlan(plan, user);
  const contribute = canContribute(plan);
  const [propose, setPropose] = useState(false);
  const vote = useAction(
    (option: PlanOption) =>
      option.hasVoted ? api.removeVote(option.id) : api.vote(option.id),
    "Voto actualizado.",
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Propuestas de fecha y lugar</h2>
          <p>Elijan juntos. Puedes votar por más de una propuesta.</p>
        </div>
        {contribute && !propose && (
          <Button variant="secondary" onClick={() => setPropose(true)}>
            <Plus size={18} />
            Proponer
          </Button>
        )}
      </div>
      {propose && contribute && (
        <OptionForm planId={planId} onClose={() => setPropose(false)} />
      )}
      <ReschedulePanel plan={plan} options={options.data ?? []} />
      <DataSection query={options}>
        {(items) =>
          items.length ? (
            <div className="option-list">
              {items.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  coverage={geography}
                  canVote={contribute}
                  canDelete={manage}
                  busy={vote.isPending}
                  onVote={() => vote.mutate(option)}
                  onDelete={() =>
                    request(
                      "¿Eliminar esta propuesta?",
                      `Se eliminarán “${option.label}” y sus votos.`,
                      "Eliminar propuesta",
                      () => api.deleteOption(planId, option.id),
                      false,
                      "danger",
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Todavía no hay propuestas">
              {contribute
                ? "Propón una fecha o un lugar para que el grupo vote."
                : "Todavía no hay propuestas para este plan."}
            </EmptyState>
          )
        }
      </DataSection>
    </>
  );
}

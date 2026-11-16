import type { UseQueryResult } from "@tanstack/react-query";
import { CalendarDays, Trash2 } from "lucide-react";
import {
  canRespond,
  formatDate,
  type PlanDetail,
  type Availability,
} from "@qsale/contracts";
import { DateRecommendations } from "../Coordination";
import { api, useSession } from "../session";
import { Button, EmptyState } from "../ui";
import { DataSection } from "./PlanDetailCards";
import { AvailabilityForm } from "./PlanDetailForms";
import type { PlanActionRequest } from "./PlanDecisionPanel";
export function PlanAvailabilitySection({
  plan,
  availability,
  request,
}: {
  plan: PlanDetail;
  availability: UseQueryResult<Availability[], Error>;
  request: PlanActionRequest;
}) {
  const { user } = useSession();
  const planId = plan.id;
  const respondable = canRespond(plan);
  return (
    <>
      <h2>Disponibilidad del grupo</h2>
      <p>
        Compara los días y horarios registrados. Todas las horas corresponden a
        Lima.
      </p>
      {respondable && (
        <details className="optional-fields">
          <summary>Añadir mi disponibilidad</summary>
          <AvailabilityForm planId={planId} />
        </details>
      )}
      <DateRecommendations planId={planId} />
      <DataSection query={availability}>
        {(items) => {
          if (!items.length)
            return (
              <EmptyState title="Todavía no hay horarios">
                Comparte cuándo puedes para ayudar al grupo a decidir.
              </EmptyState>
            );
          const days = items.reduce<Record<string, Availability[]>>(
            (result, item) => {
              (result[item.availableDate] ??= []).push(item);
              return result;
            },
            {},
          );
          return (
            <div className="availability-list">
              {Object.entries(days)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, entries]) => (
                  <section className="availability-day" key={date}>
                    <h3>
                      <CalendarDays size={18} aria-hidden="true" />
                      {formatDate(date)}{" "}
                      <small>
                        {new Set(entries.map((entry) => entry.userId)).size} con
                        disponibilidad
                      </small>
                    </h3>
                    {entries.map((item) => (
                      <div className="availability-row" key={item.id}>
                        <div>
                          <strong>{item.userName}</strong>
                          <p>
                            {item.startTime
                              ? item.startTime.slice(0, 5) +
                                "–" +
                                item.endTime?.slice(0, 5)
                              : "Todo el día"}
                          </p>
                        </div>
                        {respondable && item.userId === user!.id && (
                          <Button
                            variant="quiet"
                            aria-label="Eliminar mi disponibilidad"
                            onClick={() =>
                              request(
                                "¿Eliminar disponibilidad?",
                                "Este horario dejará de contar en la viabilidad.",
                                "Eliminar",
                                () => api.deleteAvailability(planId, item.id),
                                false,
                                "danger",
                              )
                            }
                          >
                            <Trash2 size={17} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
            </div>
          );
        }}
      </DataSection>
    </>
  );
}

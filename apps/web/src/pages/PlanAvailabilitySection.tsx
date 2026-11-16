import type { UseQueryResult } from '@tanstack/react-query';
import { CalendarDays, Trash2 } from 'lucide-react';
import { canRespond, formatDate, type PlanDetail, type Availability } from '@qsale/contracts';
import { DateRecommendations } from '../Coordination';
import { api, useSession } from '../session';
import { Button, EmptyState } from '../ui';
import { DataSection } from './PlanDetailCards';
import { AvailabilityForm } from './PlanDetailForms';
import type { PlanActionRequest } from './PlanDecisionPanel';
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
      <h2>Encuentren un momento en común</h2>
      <p>Las horas se muestran en hora de Lima.</p>
      {respondable && <AvailabilityForm planId={planId} />}
      <DateRecommendations planId={planId} />
      <DataSection query={availability}>
        {(items) =>
          items.length ? (
            <div className="availability-list">
              {items.map((item) => (
                <div className="availability-row" key={item.id}>
                  <CalendarDays size={20} />
                  <div>
                    <strong>{item.userName}</strong>
                    <p>
                      {formatDate(item.availableDate)} ·{' '}
                      {item.startTime
                        ? item.startTime.slice(0, 5) + '–' + item.endTime?.slice(0, 5)
                        : 'Todo el día'}
                    </p>
                  </div>
                  {respondable && item.userId === user!.id && (
                    <Button
                      variant="quiet"
                      aria-label="Eliminar mi disponibilidad"
                      onClick={() =>
                        request(
                          '¿Eliminar disponibilidad?',
                          'Este horario dejará de contar en la viabilidad.',
                          'Eliminar',
                          () => api.deleteAvailability(planId, item.id),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Un espacio en la agenda">
              Comparte cuándo puedes y ayuden al grupo a decidir.
            </EmptyState>
          )
        }
      </DataSection>
    </>
  );
}

import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import {
  canManagePlan,
  canRespond,
  isOrganizer,
  attendanceSummary,
  commitmentLabels,
  type Commitment,
  type CommitmentStatus,
  type Feasibility,
  type PlanDetail,
} from '@qsale/contracts';
import { api, useSession } from '../session';
import { useAction } from '../hooks';
import { Button, Field, FeasibilityIndicator } from '../ui';
import { DataSection } from './PlanDetailCards';

export type PlanActionRequest = (
  title: string,
  description: string,
  action: string,
  run: () => Promise<unknown>,
  leave?: boolean,
) => void;

export function PlanDecisionPanel({
  plan,
  feasibility,
  commitment: ownCommitment,
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
  const planId = plan.id;
  const manage = canManagePlan(plan, user);
  const respondable = canRespond(plan);
  const organizer = isOrganizer(plan, user);
  const [note, setNote] = useState<string | null>(null);
  const respond = useAction(
    (status: CommitmentStatus) => api.respond(planId, status, note ?? undefined),
    'Tu respuesta está guardada.',
    () => setNote(null),
  );
  return (
    <aside className="detail-aside">
      <section className="decision-panel">
        <h2>¿Sale o no sale?</h2>
        <DataSection query={feasibility}>
          {(value) =>
            plan.status === 'CLOSED' ? (
              <div role="status">
                <strong>
                  {attendanceSummary(value.confirmedParticipants, value.minParticipants)}
                </strong>
                <p>
                  {value.confirmedParticipants < value.minParticipants
                    ? 'Ya no se alcanza el mínimo. El acuerdo se conserva; quien organiza puede reabrirlo o cancelarlo.'
                    : 'El acuerdo sigue vigente.'}
                </p>
              </div>
            ) : plan.status === 'CANCELLED' ? (
              <p>Plan cancelado; disponible para consulta.</p>
            ) : (
              <>
                <FeasibilityIndicator value={value} />
                {!value.dateReady && <p>Falta una fecha vigente con votos.</p>}
                {!value.placeReady && <p>Falta un lugar con votos.</p>}
              </>
            )
          }
        </DataSection>
        {respondable ? (
          <>
            <h3>¿Cuentan contigo?</h3>
            <div className="commitment-buttons">
              {(['CONFIRMED', 'INTERESTED', 'CANT_GO'] as const).map((status) => (
                <Button
                  key={status}
                  variant={ownCommitment?.status === status ? 'primary' : 'secondary'}
                  busy={respond.isPending && respond.variables === status}
                  disabled={respond.isPending}
                  aria-pressed={ownCommitment?.status === status}
                  onClick={() => respond.mutate(status)}
                >
                  {status === 'CONFIRMED' ? 'Sí, voy' : commitmentLabels[status]}
                </Button>
              ))}
            </div>
            <Field
              label="Una nota para tu grupo (opcional)"
              maxLength={500}
              value={note ?? ownCommitment?.note ?? ''}
              onChange={(event) => setNote(event.target.value)}
              hint="Se guarda al elegir tu respuesta."
            />
            {ownCommitment?.note && (
              <p className="saved-note">Tu nota guardada: {ownCommitment.note}</p>
            )}
          </>
        ) : (
          <p>
            {plan.status === 'CLOSED'
              ? 'Este plan ya está confirmado. Las propuestas elegidas están marcadas en la lista.'
              : plan.status === 'CANCELLED'
                ? 'El plan se canceló. Puedes consultar lo que organizaron.'
                : 'Acepta la invitación para responder si vas.'}
          </p>
        )}
        {organizer && plan.status === 'CLOSED' && (
          <div className="organizer-actions">
            <h3>Para quien organiza</h3>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                request(
                  '¿Reabrir el plan?',
                  'Se conservarán las opciones y los votos, pero las asistencias confirmadas pasarán a pendientes para decidir un nuevo acuerdo. Las propuestas de reprogramación activas quedarán reemplazadas.',
                  'Reabrir plan',
                  () => api.reopenPlan(planId),
                )
              }
            >
              Reabrir para decidir de nuevo
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() =>
                request(
                  '¿Cancelar este plan?',
                  'El grupo recibirá un aviso y conservará el historial.',
                  'Cancelar plan',
                  () => api.cancelPlan(planId),
                )
              }
            >
              Cancelar plan
            </Button>
          </div>
        )}
        {manage && (
          <div className="organizer-actions">
            <h3>Para quien organiza</h3>
            <Button
              disabled={feasibility.data?.status !== 'READY_TO_CLOSE'}
              onClick={() =>
                request(
                  '¿Confirmar el plan?',
                  'Se fijarán el día y el lugar más votados. La hora es opcional. Cada integrante podrá actualizar su asistencia sin cambiar el acuerdo.',
                  'Confirmar plan',
                  () => api.closePlan(planId),
                )
              }
            >
              Confirmar y cerrar plan
            </Button>
            <small>Puedes confirmar cuando el plan esté listo para cerrar.</small>
            <Button
              variant="quiet"
              onClick={() =>
                request(
                  '¿Cancelar este plan?',
                  'El grupo recibirá un aviso. El plan seguirá disponible para consultar.',
                  'Cancelar plan',
                  () => api.cancelPlan(planId),
                )
              }
            >
              Cancelar plan
            </Button>
          </div>
        )}
      </section>
      {(plan.currentUserRole === 'ORGANIZER' || user?.role === 'ADMIN') && (
        <Button
          className="delete-plan"
          variant="quiet"
          onClick={() =>
            request(
              '¿Eliminar este plan definitivamente?',
              'Se borrarán el plan, las propuestas, los votos y las respuestas. Esta acción no se puede deshacer.',
              'Eliminar definitivamente',
              () => api.deletePlan(planId),
              true,
            )
          }
        >
          <Trash2 size={16} />
          Eliminar plan
        </Button>
      )}
    </aside>
  );
}

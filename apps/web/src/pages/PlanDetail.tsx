import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, Pencil, Share2, UsersRound, Wallet } from 'lucide-react';
import {
  canManagePlan,
  formatOptionDate,
  formatDate,
  formatMoney,
  planTypeLabels,
} from '@qsale/contracts';
import { api, useSession } from '../session';
import { useAction } from '../hooks';
import { usePlanData } from '../usePlanData';
import { PlanDecisionPanel } from './PlanDecisionPanel';
import { PlanShareDialog } from './PlanShareDialog';
import { PlanProposalsSection } from './PlanProposalsSection';
import { PlanGroupSection } from './PlanGroupSection';
import { PlanAvailabilitySection } from './PlanAvailabilitySection';
import { PlanMapSection } from './PlanMapSection';
import { Button, ConfirmDialog, ErrorState, Loading, PageHeading, StatusBadge } from '../ui';
export { ParticipantRow, OptionCard } from './PlanDetailCards';
export default function PlanDetail() {
  const { id } = useParams();
  const planId = Number(id);
  const valid = Number.isSafeInteger(planId) && planId > 0;
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: string;
    run: () => Promise<unknown>;
    leave?: boolean;
  } | null>(null);
  const { query, participants, commitments, feasibility, options, availability, geography } =
    usePlanData(planId);
  const accept = useAction(() => api.acceptInvitation(planId), 'Ya eres parte del grupo.');
  const destructive = useAction(
    async () => {
      if (confirm) await confirm.run();
    },
    'Cambio realizado.',
    () => {
      if (confirm?.leave) navigate('/plans');
      setConfirm(null);
    },
  );
  if (!valid) return <ErrorState error={new Error('El enlace del plan no es válido.')} />;
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const plan = query.data;
  const manage = canManagePlan(plan, user);
  const selectedTab = params.get('tab') ?? 'proposals';
  const tab = ['proposals', 'group', 'availability', 'map'].includes(selectedTab)
    ? selectedTab
    : 'proposals';
  const ownCommitment = commitments.data?.find((item) => item.userId === user!.id);
  const link = location.origin + '/join/' + plan.inviteCode;
  const request = (
    title: string,
    description: string,
    action: string,
    run: () => Promise<unknown>,
    leave = false,
  ) => setConfirm({ title, description, action, run, leave });
  return (
    <>
      <Link className="back-link" to="/plans">
        Volver a mis planes
      </Link>
      <PageHeading
        title={plan.name}
        description={
          plan.description ??
          `Un plan de ${planTypeLabels[plan.type].toLowerCase()} para compartir.`
        }
      >
        {plan.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setShare(true)}>
            <Share2 size={18} />
            Compartir
          </Button>
        )}
        {manage && (
          <Link className="button secondary" to={'/plans/' + planId + '/edit'}>
            <Pencil size={17} />
            Editar
          </Link>
        )}
      </PageHeading>
      <div className="plan-meta">
        <StatusBadge plan={plan} />
        <span>
          <CalendarDays size={17} />
          {formatDate(plan.tentativeStartDate)}
          {plan.tentativeEndDate && ' – ' + formatDate(plan.tentativeEndDate)}
        </span>
        <span>
          <Wallet size={17} />
          {formatMoney(plan.budget)} estimados
        </span>
        <span>
          <UsersRound size={17} />
          Mínimo {plan.minParticipants}
        </span>
        <span>Por {plan.creatorName}</span>
      </div>
      {plan.currentUserParticipationStatus === 'INVITED' && plan.status === 'OPEN' && (
        <section className="invitation-banner">
          <div>
            <h2>Te invitaron a este plan</h2>
            <p>Únete para proponer, votar y responder si vas.</p>
          </div>
          <Button busy={accept.isPending} onClick={() => accept.mutate(undefined)}>
            Aceptar invitación
          </Button>
        </section>
      )}
      {plan.status === 'CLOSED' && (
        <section className="inline-form" aria-label="Acuerdo vigente">
          <h2>Acuerdo vigente</h2>
          {options.data
            ?.filter((option) => option.selected)
            .map((option) => (
              <p key={option.id}>
                <strong>{option.type === 'DATE' ? formatOptionDate(option) : option.label}</strong>
              </p>
            ))}
          <p>
            Si alguien no puede asistir, el día y el lugar se conservan. Solo quien organiza puede
            aplicar una reprogramación aprobada o reabrir el plan.
          </p>
        </section>
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <nav className="detail-tabs" aria-label="Secciones del plan">
            {[
              ['proposals', 'Propuestas'],
              ['group', 'El grupo'],
              ['availability', 'Disponibilidad'],
              ['map', 'Mapa'],
            ].map(([key, label]) => (
              <button
                key={key}
                id={'tab-' + key}
                aria-controls="detail-panel"
                aria-pressed={tab === key}
                onClick={() => setParams({ tab: key! })}
              >
                {label}
              </button>
            ))}
          </nav>
          <section id="detail-panel" aria-labelledby={'tab-' + tab} className="tab-panel">
            {tab === 'proposals' && (
              <PlanProposalsSection key={plan.id} plan={plan} options={options} request={request} />
            )}
            {tab === 'group' && (
              <PlanGroupSection
                key={plan.id}
                plan={plan}
                participants={participants}
                commitments={commitments}
                busy={destructive.isPending}
                request={request}
              />
            )}
            {tab === 'availability' && (
              <PlanAvailabilitySection
                key={plan.id}
                plan={plan}
                availability={availability}
                request={request}
              />
            )}
            {tab === 'map' && (
              <PlanMapSection key={plan.id} geography={geography} options={options.data ?? []} />
            )}
          </section>
        </div>
        <PlanDecisionPanel
          key={plan.id}
          plan={plan}
          feasibility={feasibility}
          commitment={ownCommitment}
          busy={destructive.isPending}
          request={request}
        />
      </div>
      {share && (
        <PlanShareDialog inviteCode={plan.inviteCode} link={link} onClose={() => setShare(false)} />
      )}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          busy={destructive.isPending}
          onConfirm={() => destructive.mutate(undefined)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

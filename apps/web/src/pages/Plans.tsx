import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CalendarDays, Plus, Search, Ticket, UsersRound, Wallet } from 'lucide-react';
import {
  feasibilityLabels,
  formatDate,
  formatMoney,
  planTypeLabels,
  type Plan,
  type PlanStatus,
} from '@qsale/contracts';
import { api } from '../session';
import { useDebounced, usePagination } from '../hooks';
import {
  EmptyState,
  ErrorState,
  PageHeading,
  Pagination,
  SelectField,
  Skeleton,
  StatusBadge,
} from '../ui';

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className="plan-card">
      <div className={'plan-art art-' + plan.type.toLowerCase()}>
        <span>{planTypeLabels[plan.type]}</span>
        <CalendarDays size={52} strokeWidth={1.3} />
        <span className="plan-art-mark">Q.</span>
      </div>
      <div className="plan-card-content">
        <div className="card-status">
          <StatusBadge plan={plan} />
          {plan.currentUserParticipationStatus === 'INVITED' && (
            <span className="badge invite">Te invitaron</span>
          )}
        </div>
        <h2>
          <Link to={'/plans/' + plan.id}>{plan.name}</Link>
        </h2>
        <p className="plan-organizer">
          {plan.currentUserRole === 'ORGANIZER' ? 'Organizado por ti' : 'Por ' + plan.creatorName}
        </p>
        <dl>
          <div>
            <dt>
              <CalendarDays size={17} />
              Fecha
            </dt>
            <dd>{formatDate(plan.tentativeStartDate)}</dd>
          </div>
          <div>
            <dt>
              <Wallet size={17} />
              Presupuesto estimado
            </dt>
            <dd>{formatMoney(plan.budget)}</dd>
          </div>
          <div>
            <dt>
              <UsersRound size={17} />
              Mínimo para salir
            </dt>
            <dd>{plan.minParticipants} personas</dd>
          </div>
        </dl>
        <div className="plan-card-footer">
          <span className={'feasibility-label ' + plan.feasibilityStatus.toLowerCase()}>
            <i />
            {feasibilityLabels[plan.feasibilityStatus]}
          </span>
          <Link className="icon-button" aria-label={'Ver ' + plan.name} to={'/plans/' + plan.id}>
            <ArrowUpRight size={21} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export default function Plans() {
  const pager = usePagination();
  const searchParam = pager.params.get('search') ?? '';
  const [search, setSearch] = useState(searchParam);
  const debounced = useDebounced(search);
  const status = pager.params.get('status') ?? '';
  const sort = pager.params.get('sort') ?? 'createdAt,desc';
  useEffect(() => setSearch(searchParam), [searchParam]);
  useEffect(() => {
    if (debounced !== searchParam)
      pager.update({ search: debounced || undefined, page: '1' }, true);
  }, [debounced]);
  const filters = {
    page: pager.page,
    size: pager.size,
    search: searchParam || undefined,
    status: ['OPEN', 'CLOSED', 'CANCELLED'].includes(status) ? (status as PlanStatus) : undefined,
    sort,
  };
  const query = useQuery({
    queryKey: ['plans', filters],
    queryFn: ({ signal }) => api.plans(filters, signal),
  });
  useEffect(() => {
    if (query.data && pager.page > 0 && !query.data.content.length)
      pager.onChange(Math.max(0, query.data.totalPages - 1), pager.size);
  }, [query.data]);
  return (
    <>
      <PageHeading
        title="Hagamos que salga."
        description="Tus ideas, tu gente y el próximo plan para recordar."
      >
        <Link className="button secondary" to="/join">
          <Ticket size={18} />
          Tengo un código
        </Link>
        <Link className="button primary" to="/plans/new">
          <Plus size={19} />
          Crear plan
        </Link>
      </PageHeading>
      <section className="plans-intro">
        <div>
          <h2>Mis planes</h2>
          <p>De “¿cuándo nos vemos?” a “ahí nos vemos”.</p>
        </div>
        <span>{query.data ? query.data.totalElements + ' planes' : ''}</span>
      </section>
      <div className="filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Buscar planes por nombre o descripción"
            placeholder="Busca ese plan…"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <SelectField
          label="Estado"
          value={status}
          onChange={(event) => pager.update({ status: event.target.value || undefined, page: '1' })}
        >
          <option value="">Todos los estados</option>
          <option value="OPEN">Abiertos</option>
          <option value="CLOSED">Confirmados</option>
          <option value="CANCELLED">Cancelados</option>
        </SelectField>
        <SelectField
          label="Ordenar por"
          value={sort}
          onChange={(event) => pager.update({ sort: event.target.value, page: '1' })}
        >
          <option value="createdAt,desc">Más recientes</option>
          <option value="name,asc">Nombre: A–Z</option>
          <option value="tentativeStartDate,asc">Próxima fecha</option>
          <option value="feasibilityScore,desc">Mayor viabilidad</option>
          <option value="budget,asc">Menor presupuesto</option>
        </SelectField>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.content.length ? (
        <EmptyState
          title={
            searchParam || status
              ? 'Ningún plan coincide todavía'
              : 'Tu próximo buen plan empieza aquí'
          }
          action={
            <Link className="button primary" to="/plans/new">
              <Plus size={18} />
              Crear mi primer plan
            </Link>
          }
        >
          {searchParam || status
            ? 'Prueba otro nombre o cambia los filtros.'
            : 'Propón algo, invita a tu grupo y decidan juntos.'}
        </EmptyState>
      ) : (
        <div className="plan-grid">
          {query.data.content.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
    </>
  );
}

import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  canManagePlan,
  formatDate,
  planSchema,
  planTypes,
  planTypeLabels,
  type PlanInput,
} from '@qsale/contracts';
import { api, useSession } from '../session';
import { Button, ErrorState, Field, Loading, PageHeading, useToast } from '../ui';
import { ApiError } from '@qsale/api-client';

export default function PlanForm() {
  const { id } = useParams();
  const planId = Number(id);
  const editing = Boolean(id);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const toast = useToast();
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['plan', planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    enabled: editing,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<PlanInput>({
    mode: 'onTouched',
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'DINNER',
      minParticipants: 2,
      budget: null,
      tentativeStartDate: null,
      tentativeEndDate: null,
    },
  });
  const loadedPlan = useRef<number | null>(null);
  const editVersion = useRef<number | undefined>(undefined);
  const dirty = useRef(dirtyFields);
  dirty.current = dirtyFields;
  useEffect(() => {
    if (query.data) {
      const keepDraft = loadedPlan.current === query.data.id && Object.keys(dirty.current).length > 0;
      if (!keepDraft) editVersion.current = query.data.version;
      reset(
        { ...query.data, description: query.data.description ?? '' },
        {
          keepErrors: true,
          keepDirtyValues:
            loadedPlan.current === query.data.id && Object.keys(dirty.current).length > 0,
        },
      );
      loadedPlan.current = query.data.id;
    }
  }, [query.data, reset]);
  if (editing && query.isPending) return <Loading />;
  if (editing && query.isError)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (editing && query.data && !canManagePlan(query.data, user))
    return (
      <ErrorState error={new ApiError('Solo quien organiza puede editar un plan abierto.', 403)} />
    );
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  return (
    <div className="form-page">
      <Link className="back-link" to={editing ? '/plans/' + id : '/plans'}>
        <ArrowLeft size={17} />
        Volver {editing ? 'al plan' : 'a mis planes'}
      </Link>
      <PageHeading
        title={editing ? 'Ajustemos el plan' : 'Una idea. Mucho por compartir.'}
        description={
          editing
            ? 'Actualiza los detalles para que tu grupo esté al tanto.'
            : 'Empieza con lo esencial. La fecha y el lugar los pueden decidir juntos.'
        }
      />
      <form
        className="surface plan-form"
        noValidate
        onSubmit={handleSubmit(async (formValues) => {
          // A date range chosen here replaces the specific days picked in the mobile app.
          const values = {
            ...formValues,
            tentativeDates:
              formValues.tentativeStartDate || formValues.tentativeEndDate
                ? []
                : (formValues.tentativeDates ?? []),
          };
          try {
            const plan = await (editing
              ? api.updatePlan(planId, { ...values, version: editVersion.current })
              : api.createPlan(values));
            await cache.invalidateQueries();
            toast(editing ? 'Plan actualizado.' : 'Tu plan está listo para recibir ideas.');
            navigate('/plans/' + plan.id);
          } catch (error) {
            if (editing && error instanceof ApiError && error.status === 409) {
              const latest = await query.refetch();
              if (latest.data) {
                editVersion.current = latest.data.version;
                reset({ ...latest.data, description: latest.data.description ?? '' }, { keepDirtyValues: true });
              }
              setError('root', { message: 'El plan cambió en otra sesión. Conservamos tu borrador y actualizamos los demás campos. Revísalos antes de volver a guardar.' });
              return;
            }
            setError('root', { message: (error as Error).message });
          }
        })}
      >
        <Field
          label="¿Cómo se llama el plan?"
          placeholder="Por ejemplo: Reencuentro del sábado"
          maxLength={100}
          autoFocus
          {...register('name')}
          error={errors.name?.message}
        />
        <div className="field">
          <label htmlFor="description">
            Cuéntales la idea <span>(opcional)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            maxLength={1000}
            placeholder="Qué les gustaría hacer, qué deben tener en cuenta…"
            {...register('description')}
          />
          {errors.description && (
            <small className="field-error">{errors.description.message}</small>
          )}
        </div>
        <fieldset className="type-picker">
          <legend>¿Qué tipo de plan es?</legend>
          {planTypes.map((type) => (
            <label key={type}>
              <input type="radio" value={type} {...register('type')} />
              <span>{planTypeLabels[type]}</span>
            </label>
          ))}
        </fieldset>
        <div className="form-row">
          <Field
            label="Mínimo de personas"
            type="number"
            min={2}
            max={100}
            inputMode="numeric"
            hint="Cuántas confirmaciones hacen falta para salir."
            {...register('minParticipants', { valueAsNumber: true })}
            error={errors.minParticipants?.message}
          />
          <Field
            label="Presupuesto estimado (S/)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="Por definir"
            hint="Opcional. Aclara en la descripción qué incluye."
            {...register('budget', {
              setValueAs: (value) => (value == null || value === '' ? null : Number(value)),
            })}
            error={errors.budget?.message}
          />
        </div>
        <div className="form-row">
          <Field
            label="Fecha inicial tentativa"
            type="date"
            min={today}
            {...register('tentativeStartDate', { setValueAs: (value) => value || null })}
            error={errors.tentativeStartDate?.message}
          />
          <Field
            label="Fecha final tentativa"
            type="date"
            min={today}
            {...register('tentativeEndDate', { setValueAs: (value) => value || null })}
            error={errors.tentativeEndDate?.message}
          />
        </div>
        <p className="form-hint">
          Las fechas son opcionales. Todos los horarios del plan se coordinan en hora de Lima.
        </p>
        {Boolean(query.data?.tentativeDates?.length) && (
          <p className="form-hint">
            Este plan tiene días sueltos elegidos en la app:{' '}
            {query.data!.tentativeDates!.map((day) => formatDate(day)).join(', ')}. Si eliges un
            rango aquí, reemplazará esos días.
          </p>
        )}
        {errors.tentativeDates?.message && (
          <p role="alert" className="form-error">
            {errors.tentativeDates.message}
          </p>
        )}
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="form-actions">
          <Link className="button secondary" to={editing ? '/plans/' + id : '/plans'}>
            Volver
          </Link>
          <Button type="submit" busy={isSubmitting}>
            {editing ? 'Guardar cambios' : 'Crear plan'}
            <ArrowUpRight size={18} />
          </Button>
        </div>
      </form>
    </div>
  );
}

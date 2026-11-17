import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@qsale/api-client';
import {
  canManagePlan,
  planSchema,
  planTypes,
  planTypeLabels,
  type PlanInput,
} from '@qsale/contracts';
import { TentativeDatesPicker } from './Calendar';
import { NumberField } from './NumberField';
import { api, useSession } from './session';
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Loading,
  Screen,
  Tabs,
  Text,
  styles,
  useToast,
} from './ui';

export default function PlanForm({ editing = false }: { editing?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const router = useRouter();
  const { user } = useSession();
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ['plan', planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    enabled: editing,
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<PlanInput>({
    // Validate while typing, so mistakes show next to the field instead of only after "Crear plan".
    mode: 'onChange',
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'DINNER',
      minParticipants: 2,
      budget: null,
      tentativeStartDate: null,
      tentativeEndDate: null,
      tentativeDates: [],
    },
  });
  const [start, end, days] = useWatch({
    control,
    name: ['tentativeStartDate', 'tentativeEndDate', 'tentativeDates'],
  });
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const fieldLabels: Record<string, string> = {
    name: 'nombre',
    description: 'descripción',
    minParticipants: 'mínimo de personas',
    budget: 'presupuesto',
    tentativeStartDate: 'fechas',
    tentativeEndDate: 'fechas',
    tentativeDates: 'fechas',
  };
  const showInvalid = (fields: FieldErrors<PlanInput>) =>
    setInvalidFields([
      ...new Set(Object.keys(fields).flatMap((key) => (fieldLabels[key] ? [fieldLabels[key]] : []))),
    ]);
  useEffect(() => {
    if (invalidFields.length && !Object.keys(errors).length) setInvalidFields([]);
  }, [errors, invalidFields.length]);
  const loadedPlan = useRef<number | null>(null);
  const editVersion = useRef<number | undefined>(undefined);
  const dirty = useRef(dirtyFields);
  dirty.current = dirtyFields;
  useEffect(() => {
    if (query.data) {
      const keepDraft = loadedPlan.current === query.data.id && Object.keys(dirty.current).length > 0;
      if (!keepDraft) editVersion.current = query.data.version;
      reset(
        {
          ...query.data,
          description: query.data.description ?? '',
          tentativeDates: query.data.tentativeDates ?? [],
        },
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
    return (
      <Screen>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </Screen>
    );
  if (editing && query.data && !canManagePlan(query.data, user))
    return (
      <Screen>
        <ErrorState
          error={new ApiError('Solo quien organiza puede editar un plan abierto.', 403)}
        />
      </Screen>
    );
  return (
    <Screen>
      <Heading
        title={editing ? 'Ajustemos el plan' : 'Una idea. Mucho por compartir.'}
        description="Empieza con lo esencial. La fecha y el lugar los pueden decidir juntos."
      />
      <View style={styles.surface}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field
              label="¿Cómo se llama el plan?"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              maxLength={100}
              placeholder="Por ejemplo: Reencuentro del sábado"
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <Field
              label="Cuéntales la idea (opcional)"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              multiline
              numberOfLines={4}
              maxLength={1000}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
          )}
        />
        <Text style={styles.label}>¿Qué tipo de plan es?</Text>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Tabs
              items={planTypes.map((type) => [type, planTypeLabels[type]] as const)}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="minParticipants"
          render={({ field, fieldState }) => (
            <NumberField
              label="Mínimo de personas"
              value={field.value}
              onChange={field.onChange}
              integer
              error={fieldState.error?.message}
              hint="Cuántas confirmaciones hacen falta para salir."
            />
          )}
        />
        <Controller
          control={control}
          name="budget"
          render={({ field, fieldState }) => (
            <NumberField
              label="Presupuesto estimado (S/)"
              value={field.value}
              onChange={field.onChange}
              optional
              error={fieldState.error?.message}
              hint="Opcional. Aclara en la descripción qué incluye."
            />
          )}
        />
        <TentativeDatesPicker
          value={{
            tentativeStartDate: start ?? null,
            tentativeEndDate: end ?? null,
            tentativeDates: days ?? [],
          }}
          onChange={(next) => {
            const options = { shouldDirty: true, shouldValidate: true };
            setValue('tentativeStartDate', next.tentativeStartDate, options);
            setValue('tentativeEndDate', next.tentativeEndDate, options);
            setValue('tentativeDates', next.tentativeDates, options);
          }}
          error={
            errors.tentativeStartDate?.message ??
            errors.tentativeEndDate?.message ??
            errors.tentativeDates?.message
          }
        />
        {invalidFields.length > 0 && (
          <Text accessibilityRole="alert" style={styles.error}>
            {'Revisa ' + invalidFields.join(', ') + ': está marcado en rojo más arriba.'}
          </Text>
        )}
        {errors.root && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.root.message}
          </Text>
        )}
        <Button
          busy={isSubmitting}
          onPress={handleSubmit(async (values) => {
            setInvalidFields([]);
            try {
              const plan = await (editing
                ? api.updatePlan(planId, { ...values, version: editVersion.current })
                : api.createPlan(values));
              await cache.invalidateQueries();
              toast(editing ? 'Plan actualizado.' : 'Tu plan está listo para recibir ideas.');
              router.dismissTo(('/plans/' + plan.id) as '/plans/[id]');
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
          }, showInvalid)}
        >
          {editing ? 'Guardar cambios' : 'Crear plan'}
        </Button>
      </View>
    </Screen>
  );
}

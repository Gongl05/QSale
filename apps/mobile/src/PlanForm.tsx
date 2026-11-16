import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@qsale/api-client";
import {
  canManagePlan,
  planSchema,
  planTypes,
  planTypeLabels,
  type PlanInput,
} from "@qsale/contracts";
import { DateField } from "./DateField";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { NumberField } from "./NumberField";
import { api, useSession } from "./session";
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Loading,
  Screen,
  Choice,
  Text,
  useToast,
  Disclosure,
  useUI,
} from "./ui";

export default function PlanForm({ editing = false }: { editing?: boolean }) {
  const { colors, styles, dark } = useUI();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const router = useRouter();
  const { user } = useSession();
  const cache = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["plan", planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    enabled: editing,
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<PlanInput>({
    mode: "onTouched",
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "DINNER",
      minParticipants: 2,
      budget: null,
      tentativeStartDate: null,
      tentativeEndDate: null,
    },
  });
  const allowNavigation = useUnsavedChanges(
    Object.keys(dirtyFields).length > 0 && !isSubmitting,
  );
  const loadedPlan = useRef<number | null>(null);
  const editVersion = useRef<number | undefined>(undefined);
  const dirty = useRef(dirtyFields);
  dirty.current = dirtyFields;
  useEffect(() => {
    if (query.data) {
      const keepDraft =
        loadedPlan.current === query.data.id &&
        Object.keys(dirty.current).length > 0;
      if (!keepDraft) editVersion.current = query.data.version;
      reset(
        { ...query.data, description: query.data.description ?? "" },
        {
          keepErrors: true,
          keepDirtyValues:
            loadedPlan.current === query.data.id &&
            Object.keys(dirty.current).length > 0,
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
          error={
            new ApiError(
              "Solo quien organiza puede editar un plan abierto.",
              403,
            )
          }
        />
      </Screen>
    );
  return (
    <Screen>
      <Heading
        title={editing ? "Editar plan" : "Crear plan"}
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
              value={field.value ?? ""}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              multiline
              numberOfLines={4}
              maxLength={1000}
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
          )}
        />
        <Text style={styles.label}>¿Qué tipo de plan es?</Text>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Choice
              items={planTypes.map(
                (type) => [type, planTypeLabels[type]] as const,
              )}
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
        <Disclosure title="Presupuesto y fechas (opcional)">
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
          <Controller
            control={control}
            name="tentativeStartDate"
            render={({ field, fieldState }) => (
              <DateField
                label="Fecha inicial tentativa"
                value={field.value ?? ""}
                onChange={(text) => field.onChange(text || null)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="tentativeEndDate"
            render={({ field, fieldState }) => (
              <DateField
                label="Fecha final tentativa"
                value={field.value ?? ""}
                onChange={(text) => field.onChange(text || null)}
                error={fieldState.error?.message}
              />
            )}
          />
        </Disclosure>
        {errors.root && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.root.message}
          </Text>
        )}
        <Button
          busy={isSubmitting}
          onPress={handleSubmit(async (values) => {
            const today = new Date().toLocaleDateString("en-CA", {
              timeZone: "America/Lima",
            });
            if (
              [values.tentativeStartDate, values.tentativeEndDate].some(
                (value) =>
                  value &&
                  (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < today),
              )
            ) {
              setError("root", {
                message:
                  "Escribe las fechas como AAAA-MM-DD y usa hoy o una fecha futura.",
              });
              return;
            }
            try {
              const plan = await (editing
                ? api.updatePlan(planId, {
                    ...values,
                    version: editVersion.current,
                  })
                : api.createPlan(values));
              await cache.invalidateQueries();
              toast(
                editing
                  ? "Plan actualizado."
                  : "Tu plan está listo para recibir ideas.",
              );
              reset(values);
              allowNavigation();
              router.dismissTo(("/plans/" + plan.id) as "/plans/[id]");
            } catch (error) {
              if (
                editing &&
                error instanceof ApiError &&
                error.status === 409
              ) {
                const latest = await query.refetch();
                if (latest.data) {
                  editVersion.current = latest.data.version;
                  reset(
                    {
                      ...latest.data,
                      description: latest.data.description ?? "",
                    },
                    { keepDirtyValues: true },
                  );
                }
                setError("root", {
                  message:
                    "El plan cambió en otra sesión. Conservamos tu borrador y actualizamos los demás campos. Revísalos antes de volver a guardar.",
                });
                return;
              }
              setError("root", { message: (error as Error).message });
            }
          })}
        >
          {editing ? "Guardar cambios" : "Crear plan"}
        </Button>
      </View>
    </Screen>
  );
}

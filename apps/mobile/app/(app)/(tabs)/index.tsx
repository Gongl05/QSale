import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Feather from "@expo/vector-icons/Feather";
import {
  planProgressLabel,
  formatDate,
  formatMoney,
  planStatusLabels,
  planTypeLabels,
  type PlanStatus,
} from "@qsale/contracts";
import { api } from "../../../src/session";
import { useDebounced, usePagination } from "../../../src/hooks";
import {
  Badge,
  Button,
  Choice,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Loading,
  Pagination,
  Screen,
  Sheet,
  Text,
  useUI,
} from "../../../src/ui";

export default function Plans() {
  const { styles, colors } = useUI();
  const router = useRouter();
  const pager = usePagination();
  const [search, setSearch] = useState(pager.params.search ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounced = useDebounced(search);
  const status = pager.params.status ?? "";
  const sort = pager.params.sort || "createdAt,desc";
  useEffect(() => setSearch(pager.params.search ?? ""), [pager.params.search]);
  useEffect(() => {
    if (debounced !== (pager.params.search ?? ""))
      pager.update({ search: debounced, page: "1" });
  }, [debounced]);
  const filters = {
    page: pager.page,
    size: pager.size,
    search: pager.params.search || undefined,
    status: ["OPEN", "CLOSED", "CANCELLED"].includes(status)
      ? (status as PlanStatus)
      : undefined,
    sort,
  };
  const query = useQuery({
    queryKey: ["plans", filters],
    queryFn: ({ signal }) => api.plans(filters, signal),
  });
  useEffect(() => {
    if (query.data && pager.page > 0 && !query.data.content.length)
      pager.onChange(Math.max(0, query.data.totalPages - 1), pager.size);
  }, [query.data]);
  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Heading title="Mis planes" description="Fecha, lugar y quién va" />
      <View style={styles.row}>
        <Button icon="plus" onPress={() => router.push("/plans/new")}>
          Crear plan
        </Button>
        <Button
          variant="secondary"
          icon="link"
          onPress={() => router.push("/join")}
        >
          Unirme con código
        </Button>
      </View>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Buscar planes"
            placeholder="Buscar por nombre"
            value={search}
            onChangeText={setSearch}
            maxLength={200}
          />
        </View>
        <Button
          variant="secondary"
          icon="sliders"
          onPress={() => setFiltersOpen(true)}
        >
          Filtros
        </Button>
      </View>
      {Boolean(status || sort !== "createdAt,desc") && (
        <Text style={styles.muted}>
          {status
            ? planStatusLabels[status as PlanStatus]
            : "Todos los estados"}{" "}
          · Orden personalizado
        </Text>
      )}
      {query.data && (
        <Text style={styles.muted}>
          {query.data.totalElements}{" "}
          {query.data.totalElements === 1 ? "plan" : "planes"}
        </Text>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.content.length ? (
        <View style={{ gap: 16 }}>
          <EmptyState
            title={
              search || status ? "Sin resultados" : "Todavía no tienes planes"
            }
          >
            {search || status
              ? "Cambia la búsqueda o elimina los filtros."
              : "Crea un plan o únete con una invitación de tu grupo."}
          </EmptyState>
          {Boolean(search || status) && (
            <Button
              variant="secondary"
              onPress={() => {
                setSearch("");
                pager.update({ search: "", status: "", page: "1" });
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </View>
      ) : (
        query.data.content.map((plan) => {
          const agreement = (
            plan as typeof plan & {
              agreement?: {
                date: string | null;
                time: string | null;
                place: string | null;
              } | null;
            }
          ).agreement;
          const final = plan.status === "CLOSED";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver ${plan.name}, ${planStatusLabels[plan.status]}`}
              key={plan.id}
              style={({ pressed }) => [
                styles.planCard,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() =>
                router.push(("/plans/" + plan.id) as "/plans/[id]")
              }
            >
              <View style={styles.planBody}>
                <View style={styles.between}>
                  <Text style={styles.muted}>{planTypeLabels[plan.type]}</Text>
                  <Badge good={final}>{planStatusLabels[plan.status]}</Badge>
                </View>
                <View style={styles.between}>
                  <Text style={[styles.heading, { flex: 1 }]}>{plan.name}</Text>
                  <Feather
                    name="arrow-up-right"
                    size={20}
                    color={colors.muted}
                  />
                </View>
                <Text style={styles.subtitle}>
                  {final
                    ? agreement?.date
                      ? formatDate(agreement.date) +
                        (agreement.time ? " · " + agreement.time.slice(0, 5) : "")
                      : "Ver acuerdo confirmado"
                    : formatDate(plan.tentativeStartDate)}
                  {!final && plan.tentativeStartDate ? " · Tentativa" : ""}
                </Text>
                {final && agreement?.place && (
                  <Text style={styles.subtitle}>{agreement.place}</Text>
                )}
                <Text style={styles.muted}>
                  {formatMoney(plan.budget)} estimados · Mínimo{" "}
                  {plan.minParticipants} personas
                </Text>
                <View style={styles.divider} />
                <View style={styles.between}>
                  <Text
                    style={[
                      styles.muted,
                      { flex: 1, color: final ? colors.green : colors.muted },
                    ]}
                  >
                    {planProgressLabel(plan)}
                  </Text>
                  {plan.currentUserParticipationStatus === "INVITED" && (
                    <Badge>Te invitaron</Badge>
                  )}
                </View>
                <Text style={styles.muted}>
                  {plan.currentUserRole === "ORGANIZER"
                    ? "Organizado por ti"
                    : "Por " + plan.creatorName}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
      {filtersOpen && (
        <Sheet title="Filtrar planes" onClose={() => setFiltersOpen(false)}>
          <Text style={styles.label}>Estado</Text>
          <Choice
            items={
              [
                ["", "Todos"],
                ["OPEN", "Abiertos"],
                ["CLOSED", "Confirmados"],
                ["CANCELLED", "Cancelados"],
              ] as const
            }
            value={status}
            onChange={(value) => pager.update({ status: value, page: "1" })}
          />
          <Text style={styles.label}>Ordenar por</Text>
          <Choice
            items={
              [
                ["createdAt,desc", "Recientes"],
                ["name,asc", "Nombre"],
                ["tentativeStartDate,asc", "Fecha"],
                ["feasibilityScore,desc", "Coordinación"],
                ["budget,asc", "Presupuesto"],
              ] as const
            }
            value={sort}
            onChange={(value) => pager.update({ sort: value, page: "1" })}
          />
          <Button onPress={() => setFiltersOpen(false)}>Ver planes</Button>
        </Sheet>
      )}
    </Screen>
  );
}

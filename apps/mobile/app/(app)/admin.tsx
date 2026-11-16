import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@qsale/api-client";
import type { User } from "@qsale/contracts";
import { api, useSession } from "../../src/session";
import {
  Button,
  ErrorState,
  EmptyState,
  Field,
  Heading,
  Loading,
  Screen,
  Text,
  confirmAction,
  useAction,
  useUI,
} from "../../src/ui";
export default function Admin() {
  const { colors, styles, dark } = useUI();
  const { user, updateUser } = useSession();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin", "users"],
    queryFn: ({ signal }) => api.users(signal),
    enabled: user?.role === "ADMIN",
  });
  const change = useAction(async (target: User) => {
    await api.updateRole(target.id, target.role === "ADMIN" ? "USER" : "ADMIN");
    if (target.id === user?.id) updateUser(await api.me());
  }, "Rol actualizado.");
  const filteredUsers =
    query.data?.filter((item) =>
      (item.name + " " + item.email)
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  if (user?.role !== "ADMIN")
    return (
      <Screen>
        <ErrorState
          error={
            new ApiError(
              "Solo los administradores pueden ver esta pantalla.",
              403,
            )
          }
        />
      </Screen>
    );
  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <Heading
        title="Administración"
        description="Un administrador puede gestionar todos los planes. QSale debe conservar al menos uno."
      />
      <Field label="Buscar usuario" value={search} onChangeText={setSearch} />
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : filteredUsers.length ? (
        filteredUsers.map((item) => (
          <View key={item.id} style={styles.surface}>
            <Text style={styles.subheading}>{item.name}</Text>
            <Text style={styles.muted}>{item.email}</Text>
            <Text>{item.role === "ADMIN" ? "Administrador" : "Usuario"}</Text>
            {item.role === "ADMIN" &&
              query.data.filter((person) => person.role === "ADMIN").length ===
                1 && (
                <Text style={styles.muted}>
                  Es el último administrador. Asigna este acceso a otra persona
                  antes de retirarlo.
                </Text>
              )}
            <Button
              variant="secondary"
              busy={change.isPending && change.variables?.id === item.id}
              disabled={
                change.isPending ||
                (item.role === "ADMIN" &&
                  query.data.filter((user) => user.role === "ADMIN").length ===
                    1)
              }
              onPress={() =>
                confirmAction(
                  "¿Cambiar este acceso?",
                  `${item.name} pasará a ser ${item.role === "ADMIN" ? "usuario" : "administrador"}. Este cambio afecta sus permisos inmediatamente.`,
                  () => change.mutate(item),
                )
              }
            >
              {item.role === "ADMIN"
                ? "Cambiar a usuario"
                : "Hacer administrador"}
            </Button>
          </View>
        ))
      ) : (
        <View>
          <EmptyState title="No encontramos usuarios con esa búsqueda">
            Prueba con otro nombre o correo.
          </EmptyState>
          <Button variant="secondary" onPress={() => setSearch("")}>
            Limpiar búsqueda
          </Button>
        </View>
      )}
    </Screen>
  );
}

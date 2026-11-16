import { useState } from "react";
import { View } from "react-native";
import {
  validDay,
  todayInLima,
  type AvailabilityInput,
} from "@qsale/contracts";
import { DateField } from "./DateField";
import { api } from "./session";
import { Button, Text, useAction, useUI } from "./ui";
import { useUnsavedChanges } from "./useUnsavedChanges";

export function AvailabilityForm({ planId }: { planId: number }) {
  const { colors, styles, dark } = useUI();
  const [date, setDate] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [error, setError] = useState("");
  const save = useAction(
    (data: AvailabilityInput) => api.addAvailability(planId, data),
    "Tu disponibilidad está guardada.",
    () => {
      setDate("");
      setStart("");
      setEnd("");
    },
  );
  useUnsavedChanges(!save.isPending && Boolean(date || start || end));
  return (
    <View style={styles.surface}>
      <Text style={styles.subheading}>¿Cuándo tienes un espacio?</Text>
      <DateField label="Día" value={date} onChange={setDate} optional={false} />
      <DateField
        label="Desde (opcional)"
        mode="time"
        value={start}
        onChange={setStart}
      />
      <DateField
        label="Hasta (opcional)"
        mode="time"
        value={end}
        onChange={setEnd}
      />
      <Text style={styles.muted}>
        Hora de Lima. Si no indicas horas, se registra todo el día.
      </Text>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        busy={save.isPending}
        onPress={() => {
          setError("");
          const today = todayInLima();
          if (!validDay(date) || date < today) {
            setError("Elige hoy o una fecha futura con el formato indicado.");
            return;
          }
          if (
            Boolean(start) !== Boolean(end) ||
            (start &&
              (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
                end <= start))
          ) {
            setError(
              "Completa ambas horas con el formato HH:mm, colocando el final después del inicio, o deja ambas vacías.",
            );
            return;
          }
          save.mutate({
            availableDate: date,
            ...(start ? { startTime: start, endTime: end } : {}),
          });
        }}
      >
        Añadir disponibilidad
      </Button>
    </View>
  );
}

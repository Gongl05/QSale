import { View } from "react-native";
import { formatDate, type Availability } from "@qsale/contracts";
import type { PlanActionRequest } from "./PlanManagementActions";
import { api } from "./session";
import { Button, Text, useUI } from "./ui";
export function AvailabilityList({
  items,
  planId,
  userId,
  respondable,
  busy,
  request,
}: {
  items: Availability[];
  planId: number;
  userId: number;
  respondable: boolean;
  busy: boolean;
  request: PlanActionRequest;
}) {
  const { styles } = useUI();
  const days = [...new Set(items.map((item) => item.availableDate))].sort();
  return (
    <>
      {days.map((day) => {
        const entries = items.filter((item) => item.availableDate === day);
        return (
          <View key={day} style={styles.surface}>
            <View style={styles.between}>
              <Text style={styles.subheading}>{formatDate(day)}</Text>
              <Text style={styles.muted}>
                {new Set(entries.map((item) => item.userId)).size} personas
              </Text>
            </View>
            {entries.map((item) => (
              <View key={item.id} style={{ gap: 8 }}>
                <View style={styles.divider} />
                <View style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text>{item.userName}</Text>
                    <Text style={styles.muted}>
                      {item.startTime
                        ? item.startTime.slice(0, 5) +
                          "–" +
                          item.endTime?.slice(0, 5)
                        : "Todo el día"}
                    </Text>
                  </View>
                  {respondable && item.userId === userId && (
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onPress={() =>
                        request(
                          "¿Eliminar disponibilidad?",
                          "Este horario dejará de contar en la coordinación.",
                          () => api.deleteAvailability(planId, item.id),
                        )
                      }
                    >
                      Eliminar
                    </Button>
                  )}
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

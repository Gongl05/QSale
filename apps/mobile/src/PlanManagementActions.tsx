import { View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  canManagePlan,
  isOrganizer,
  formatDate,
  type PlanDetail,
  type Feasibility,
} from "@qsale/contracts";
import { api, useSession } from "./session";
import { Button, Text, useUI } from "./ui";
export type PlanActionRequest = (
  title: string,
  description: string,
  action: () => Promise<unknown>,
  leave?: boolean,
) => void;
export function PlanManagementActions({
  plan,
  feasibility,
  busy,
  request,
}: {
  plan: PlanDetail;
  feasibility: UseQueryResult<Feasibility, Error>;
  busy: boolean;
  request: PlanActionRequest;
}) {
  const { colors, styles, dark } = useUI();
  const { user } = useSession();
  const planId = plan.id;
  const preview = (
    plan as typeof plan & {
      closingPreview?: {
        date: string | null;
        time: string | null;
        place: string | null;
      } | null;
    }
  ).closingPreview;
  const previewText = preview
    ? `${preview.date ? formatDate(preview.date) : "Día por definir"}${preview.time ? " · " + preview.time : ""} · ${preview.place ?? "Lugar por definir"}`
    : "Se fijarán el día y el lugar más votados según el acuerdo del grupo.";
  const manage = canManagePlan(plan, user);
  const organizer = isOrganizer(plan, user);
  return (
    <>
      {organizer && plan.status === "CLOSED" && (
        <View style={styles.surface}>
          <Text style={styles.subheading}>Para quien organiza</Text>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() =>
              request(
                "¿Reabrir el plan?",
                "Se conservarán las opciones y los votos, pero las asistencias confirmadas pasarán a pendientes para decidir un nuevo acuerdo. Las reprogramaciones activas quedarán reemplazadas.",
                () => api.reopenPlan(planId),
              )
            }
          >
            Reabrir para decidir de nuevo
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() =>
              request(
                "¿Cancelar este plan?",
                "El grupo recibirá un aviso y conservará el historial.",
                () => api.cancelPlan(planId),
              )
            }
          >
            Cancelar plan
          </Button>
        </View>
      )}
      {manage && (
        <View style={styles.surface}>
          <Text style={styles.subheading}>Para quien organiza</Text>
          {preview && (
            <View style={styles.note}>
              <Text style={styles.label}>Acuerdo que se confirmará</Text>
              <Text>{previewText}</Text>
            </View>
          )}
          <Button
            busy={busy}
            disabled={feasibility.data?.status !== "READY_TO_CLOSE"}
            onPress={() =>
              request(
                "¿Confirmar el plan?",
                previewText +
                  " Cada integrante podrá actualizar su asistencia sin cambiar el acuerdo.",
                () => api.closePlan(planId),
              )
            }
          >
            Confirmar y cerrar plan
          </Button>
          <Text style={styles.muted}>
            Disponible cuando la viabilidad indica “Listo para cerrar”.
          </Text>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() =>
              request(
                "¿Cancelar este plan?",
                "El grupo recibirá un aviso. El plan seguirá disponible para consultar.",
                () => api.cancelPlan(planId),
              )
            }
          >
            Cancelar plan
          </Button>
        </View>
      )}
      {(plan.currentUserRole === "ORGANIZER" || user!.role === "ADMIN") && (
        <Button
          variant="quiet"
          icon="trash-2"
          disabled={busy}
          onPress={() =>
            request(
              "¿Eliminar definitivamente?",
              "Se borrarán el plan, propuestas, votos y respuestas. Esta acción no se puede deshacer.",
              () => api.deletePlan(planId),
              true,
            )
          }
        >
          Eliminar plan
        </Button>
      )}
    </>
  );
}

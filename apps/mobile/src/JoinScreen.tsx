import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "./session";
import { Button, Field, Heading, Screen, Text, useAction, useUI } from "./ui";

export function invitationCode(input: string) {
  const raw = input.trim();
  if (/^[a-f\d]{8}$/i.test(raw)) return raw.toUpperCase();
  try {
    const url = new URL(raw);
    const webOrigin = process.env.EXPO_PUBLIC_WEB_URL
      ? new URL(process.env.EXPO_PUBLIC_WEB_URL).origin
      : null;
    const path =
      url.protocol === "qsale:"
        ? "/" + url.host + url.pathname
        : webOrigin && url.origin === webOrigin
          ? url.pathname
          : "";
    const match = path.match(/^\/join\/([a-f\d]{8})\/?$/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}
export default function JoinScreen() {
  const { colors, styles, dark } = useUI();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? ""),
    [camera, setCamera] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const action = useAction(
    (code: string) => api.join(code),
    "Ya eres parte del plan.",
  );
  return (
    <Screen>
      <Heading
        title="Unirme a un plan"
        description="Escribe el código de tu grupo o escanea su invitación."
      />
      <View style={styles.surface}>
        <Field
          label="Código de invitación"
          value={code}
          onChangeText={(text) =>
            setCode(text.replace(/\s/g, "").toUpperCase().slice(0, 8))
          }
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
          error={error || undefined}
          placeholder="A1B2C3D4"
          style={styles.code}
        />
        <Text style={styles.subtitle}>
          Unirte al grupo te permite proponer y votar. Después podrás confirmar
          si vas.
        </Text>
        <Button
          busy={action.isPending}
          onPress={() => {
            setError("");
            const parsed = invitationCode(code);
            if (!parsed) {
              setError(
                "Copia los 8 caracteres del código de invitación y revisa que esté completo.",
              );
              return;
            }
            action.mutate(parsed, {
              onSuccess: (result) => {
                const participant = result as { planId: number };
                router.dismissTo(
                  ("/plans/" + participant.planId) as "/plans/[id]",
                );
              },
            });
          }}
        >
          Unirme al plan
        </Button>
        <Button
          variant="secondary"
          icon="camera"
          onPress={async () => {
            setError("");
            try {
              const result = permission?.granted
                ? permission
                : await requestPermission();
              if (result.granted) {
                lock.current = false;
                setCamera(true);
              } else
                setError(
                  "No se concedió acceso a la cámara. Puedes ingresar el código manualmente o habilitar el permiso en Ajustes.",
                );
            } catch {
              setError(
                "No pudimos abrir la cámara. Puedes ingresar el código de invitación manualmente.",
              );
            }
          }}
        >
          Escanear invitación
        </Button>
        {permission && !permission.granted && !permission.canAskAgain && (
          <Button variant="quiet" onPress={() => void Linking.openSettings()}>
            Abrir ajustes de permisos
          </Button>
        )}
      </View>
      {camera && permission?.granted && (
        <View style={{ gap: 15 }}>
          <View style={{ height: 340, borderRadius: 15, overflow: "hidden" }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(event) => {
                if (lock.current) return;
                lock.current = true;
                const parsed = invitationCode(event.data);
                setCamera(false);
                if (parsed) {
                  setCode(parsed);
                  setError("");
                } else
                  setError(
                    "Este QR no corresponde a una invitación de Quesale. Solicita el código a quien organiza.",
                  );
              }}
            />
          </View>
          <Text style={styles.muted}>
            El código aparecerá arriba. Revisa la invitación antes de unirte;
            escanear no confirma ninguna acción.
          </Text>
          <Button variant="secondary" onPress={() => setCamera(false)}>
            Cerrar cámara
          </Button>
        </View>
      )}
    </Screen>
  );
}

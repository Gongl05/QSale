import { useState } from "react";
import { useRouter } from "expo-router";
import { createPasswordRecoveryClient } from "@qsale/api-client";
import { apiURL } from "../src/session";
import { Button, Field, Heading, Screen, Text, useUI } from "../src/ui";

const recovery = createPasswordRecoveryClient(apiURL);
export default function PasswordRecovery() {
  const { styles } = useUI();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <Screen>
      <Heading
        title="Recuperar contraseña"
        description="Te enviaremos un enlace para elegir una contraseña nueva."
      />
      {sent ? (
        <Text accessibilityRole="status" style={styles.note}>
          Si el correo tiene una cuenta, recibirás un enlace de recuperación.
          Revisa también la carpeta de correo no deseado.
        </Text>
      ) : (
        <>
          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            error={error || undefined}
          />
          <Button
            busy={busy}
            onPress={async () => {
              setError("");
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                setError("Escribe un correo electrónico válido.");
                return;
              }
              setBusy(true);
              try {
                await recovery.request(email.trim());
                setSent(true);
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Enviar enlace
          </Button>
        </>
      )}
      <Button variant="quiet" onPress={() => router.replace("/login")}>
        Volver a iniciar sesión
      </Button>
    </Screen>
  );
}

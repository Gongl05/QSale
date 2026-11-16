import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPasswordRecoveryClient } from "@qsale/api-client";
import { signUpSchema } from "@qsale/contracts";
import { ArrowRight, Check } from "lucide-react";
import { Button, Field } from "../ui";
import { AuthLayout } from "./AuthLayout";

const recovery = createPasswordRecoveryClient("/session", "session");
export default function PasswordRecovery() {
  const resetting = useLocation().pathname === "/reset-password";
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = `${resetting ? "Nueva contraseña" : "Recuperar contraseña"} · Quesale`;
    if (!resetting) return;
    const previous = document.querySelector<HTMLMetaElement>(
      'meta[name="referrer"]',
    );
    const original = previous?.content;
    const meta = previous ?? document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    if (!previous) document.head.append(meta);
    if (window.location.search.includes("token="))
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    return () => {
      if (previous) previous.content = original ?? "";
      else meta.remove();
    };
  }, [resetting]);
  return (
    <AuthLayout>
      <div>
        <h1>{resetting ? "Nueva contraseña" : "Recuperar contraseña"}</h1>
        <p>
          {resetting
            ? "Elige una contraseña nueva para volver a entrar a tu cuenta."
            : "Te enviaremos un enlace para elegir una contraseña nueva."}
        </p>
        {done ? (
          <>
            <div className="auth-success" role="status">
              <Check size={24} aria-hidden="true" />
              <p>
                {resetting
                  ? "Tu contraseña se actualizó. Inicia sesión con la nueva contraseña."
                  : "Si el correo tiene una cuenta, recibirás un enlace. Revisa también el correo no deseado."}
              </p>
            </div>
            <a className="button primary" href="/login">
              Volver a iniciar sesión
              <ArrowRight size={18} />
            </a>
          </>
        ) : resetting && !token ? (
          <>
            <p className="form-error" role="alert">
              El enlace está incompleto. Solicita uno nuevo desde tu correo.
            </p>
            <Link className="button primary" to="/forgot-password">
              Solicitar otro enlace
            </Link>
          </>
        ) : (
          <form
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              if (resetting) {
                const parsed = signUpSchema.shape.password.safeParse(password);
                if (!parsed.success) {
                  setError(
                    parsed.error.issues[0]?.message ?? "Revisa la contraseña",
                  );
                  return;
                }
                if (password !== confirmation) {
                  setError("Las contraseñas no coinciden");
                  return;
                }
              } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                setError("Escribe un correo electrónico válido");
                return;
              }
              setBusy(true);
              try {
                if (resetting) await recovery.confirm(token, password);
                else await recovery.request(email);
                setDone(true);
                setPassword("");
                setConfirmation("");
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {resetting ? (
              <>
                <Field
                  label="Nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  hint="Al menos 8 caracteres, una mayúscula, una minúscula y un número"
                />
                <Field
                  label="Repite la contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            ) : (
              <Field
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" busy={busy}>
              {resetting ? "Guardar nueva contraseña" : "Enviar enlace"}
              <ArrowRight size={18} />
            </Button>
            {resetting && error && (
              <Link className="recovery-link" to="/forgot-password">
                Solicitar otro enlace
              </Link>
            )}
          </form>
        )}
        {!done && (
          <p className="auth-switch">
            <Link to="/login">Volver a iniciar sesión</Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}

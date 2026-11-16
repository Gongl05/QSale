import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  safeReturnPath,
  signInSchema,
  signUpSchema,
  type SignUpInput,
} from "@qsale/contracts";
import { useSession } from "../session";
import { Button, Field, Loading } from "../ui";
import { AuthLayout } from "./AuthLayout";

export default function Auth() {
  const registering = useLocation().pathname === "/register";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useSession();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnPath(params.get("returnTo"));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    mode: "onTouched",
    resolver: zodResolver(registering ? signUpSchema : signInSchema) as never,
  });
  useEffect(() => {
    document.title = `${registering ? "Crear cuenta" : "Iniciar sesión"} · Quesale`;
  }, [registering]);
  if (loading) return <Loading label="Preparando Quesale…" />;
  if (user) return <Navigate to={returnTo} replace />;
  return (
    <AuthLayout>
      <div>
        <h1>{registering ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p>
          {registering
            ? "Crea tu cuenta para organizar planes con tu grupo."
            : "Entra para ver tus planes y responder a tu grupo."}
        </p>
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            setError("");
            try {
              await (registering ? signUp(values) : signIn(values));
              navigate(returnTo, { replace: true });
            } catch (failure) {
              setError((failure as Error).message);
            }
          })}
        >
          {registering && (
            <Field
              label="Tu nombre"
              autoComplete="name"
              error={errors.name?.message}
              {...register("name")}
            />
          )}
          <Field
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <div className="password-field">
            <Field
              label="Contraseña"
              type={visible ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              error={errors.password?.message}
              hint={
                registering
                  ? "Al menos 8 caracteres, una mayúscula, una minúscula y un número"
                  : undefined
              }
              {...register("password")}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {!registering && (
            <Link className="recovery-link" to="/forgot-password">
              Olvidé mi contraseña
            </Link>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" busy={isSubmitting}>
            {registering ? "Crear mi cuenta" : "Entrar a Quesale"}
            <ArrowRight size={18} />
          </Button>
        </form>
        <p className="auth-switch">
          {registering ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
          <Link
            to={
              (registering ? "/login" : "/register") +
              "?returnTo=" +
              encodeURIComponent(returnTo)
            }
          >
            {registering ? "Inicia sesión" : "Crea tu cuenta"}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

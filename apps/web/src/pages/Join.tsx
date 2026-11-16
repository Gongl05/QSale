import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ticket } from "lucide-react";
import { api } from "../session";
import { Button, Field, PageHeading, useToast } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

export default function Join() {
  const { code: initialCode } = useParams();
  const [code, setCode] = useState(initialCode ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const cache = useQueryClient();
  return (
    <div className="form-page narrow">
      <PageHeading
        title="Unirme a un plan"
        description="Usa el código de invitación que compartió tu grupo."
      />
      <form
        className="surface"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (!/^[a-f\d]{8}$/i.test(code.trim())) {
            setError(
              "Copia los 8 caracteres del código de invitación. Revisa que esté completo y no incluya otros símbolos.",
            );
            event.currentTarget.querySelector("input")?.focus();
            return;
          }
          setBusy(true);
          try {
            const participant = await api.join(code);
            await cache.invalidateQueries();
            toast("Ya eres parte del plan.");
            navigate("/plans/" + participant.planId);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Ticket className="join-icon" size={40} />
        <Field
          label="Código de invitación"
          className="code-input"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          error={error || undefined}
          maxLength={32}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\s/g, "").toUpperCase());
            setError("");
          }}
          placeholder="A1B2C3D4"
        />
        <p className="form-hint">
          Unirte al grupo te permite proponer y votar. Después podrás confirmar
          si vas.
        </p>
        <div className="form-actions">
          <Link className="button secondary" to="/plans">
            Volver
          </Link>
          <Button busy={busy}>Unirme al plan</Button>
        </div>
      </form>
    </div>
  );
}

import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import {
  dateInputError,
  dateOptionInput,
  validDay,
  todayInLima,
  locationSchema,
  type AvailabilityInput,
  type Location,
  type OptionInput,
} from "@qsale/contracts";
import { api } from "../session";
import { useAction } from "../hooks";
import { Button, Field } from "../ui";
import { LocationPicker } from "../Map";
import { useUnsavedChanges } from "../useUnsavedChanges";
export function OptionForm({
  planId,
  onClose,
}: {
  planId: number;
  onClose: () => void;
}) {
  const [type, setType] = useState<"DATE" | "PLACE">("DATE");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState("");
  const guard = useUnsavedChanges(
    Boolean(
      label || description || start || end || startTime || endTime || location,
    ),
  );
  const action = useAction(
    (data: OptionInput) => api.createOption(planId, data),
    "Propuesta lista para recibir votos.",
    () => {
      guard.allowNavigation();
      onClose();
    },
  );
  return (
    <form
      className="inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        if (label.trim().length < 3 || label.trim().length > 120) {
          setError("El título necesita entre 3 y 120 caracteres.");
          return;
        }
        const dateError = dateInputError(start, startTime, end, endTime);
        if (type === "DATE" && dateError) {
          setError(dateError);
          return;
        }
        if (type === "PLACE" && !locationSchema.safeParse(location).success) {
          setError("Elige una ubicación válida para el lugar.");
          return;
        }
        action.mutate({
          type,
          label: label.trim(),
          description,
          ...(type === "DATE"
            ? dateOptionInput(start, startTime, end, endTime)
            : { location: location! }),
        });
      }}
    >
      <h3>Nueva propuesta</h3>
      <div className="segmented" aria-label="Tipo de propuesta">
        <button
          type="button"
          aria-pressed={type === "DATE"}
          onClick={() => setType("DATE")}
        >
          <CalendarDays size={17} />
          Fecha
        </button>
        <button
          type="button"
          aria-pressed={type === "PLACE"}
          onClick={() => setType("PLACE")}
        >
          <MapPin size={17} />
          Lugar
        </button>
      </div>
      <Field
        label="Título de la propuesta"
        value={label}
        maxLength={120}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={
          type === "DATE"
            ? "Por ejemplo: Sábado por la tarde"
            : "Por ejemplo: Parque Kennedy"
        }
      />
      <Field
        label="Un detalle para el grupo (opcional)"
        value={description}
        maxLength={500}
        onChange={(event) => setDescription(event.target.value)}
      />
      {type === "DATE" ? (
        <div className="form-row">
          <Field
            label="Día de inicio"
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <details
            className="optional-fields"
            open={Boolean(error && (end || endTime)) || undefined}
          >
            <summary>
              Hora y duración <span>(opcional)</span>
            </summary>
            <Field
              label="Hora de inicio (Lima, opcional)"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <Field
              label="Hora final (opcional)"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
            <Field
              label="Día final (opcional)"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </details>
        </div>
      ) : (
        <LocationPicker value={location} onChange={setLocation} />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions end">
        <Button
          type="button"
          variant="secondary"
          disabled={action.isPending}
          onClick={() => guard.confirmDiscard(onClose)}
        >
          Cancelar propuesta
        </Button>
        <Button busy={action.isPending}>Publicar propuesta</Button>
      </div>
      {guard.dialog}
    </form>
  );
}
export function AvailabilityForm({ planId }: { planId: number }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const guard = useUnsavedChanges(Boolean(date || start || end));
  const action = useAction(
    (input: AvailabilityInput) => api.addAvailability(planId, input),
    "Tu disponibilidad está guardada.",
    () => {
      setDate("");
      setStart("");
      setEnd("");
    },
  );
  return (
    <form
      className="inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        const today = todayInLima();
        if (!validDay(date) || date < today) {
          setError("Elige hoy o una fecha futura.");
          return;
        }
        if (Boolean(start) !== Boolean(end) || (start && end <= start)) {
          setError(
            "Completa ambas horas y coloca el final después del inicio, o deja ambas vacías.",
          );
          return;
        }
        action.mutate({
          availableDate: date,
          ...(start ? { startTime: start, endTime: end } : {}),
        });
      }}
    >
      <h3>Añadir disponibilidad</h3>
      <p>Indica cuándo puedes. Este horario no confirma tu asistencia.</p>
      <div className="form-row three">
        <Field
          label="Día"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Field
          label="Desde (opcional)"
          type="time"
          value={start}
          onChange={(event) => setStart(event.target.value)}
        />
        <Field
          label="Hasta (opcional)"
          type="time"
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button busy={action.isPending}>Añadir disponibilidad</Button>
      {guard.dialog}
    </form>
  );
}

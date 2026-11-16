import { type ReactNode } from "react";
import { CalendarDays, Check, MapPin, ThumbsUp, Trash2 } from "lucide-react";
import {
  formatOptionDate,
  commitmentLabels,
  type CommitmentStatus,
  type Participant,
  type PlanOption,
  type Geography,
} from "@qsale/contracts";
import { Button, ErrorState, Skeleton } from "../ui";
export function DataSection<T>({
  query,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (value: T) => ReactNode;
}) {
  return query.isPending ? (
    <Skeleton rows={2} />
  ) : query.isError ? (
    <ErrorState error={query.error!} retry={() => void query.refetch()} />
  ) : (
    <>{children(query.data!)}</>
  );
}
export function ParticipantRow({
  item,
  commitment,
  note,
  canRemove,
  onRemove,
  busy,
}: {
  item: Participant;
  commitment?: CommitmentStatus;
  note?: string | null;
  canRemove: boolean;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="participant-row">
      <span className="avatar">{item.userName.slice(0, 1).toUpperCase()}</span>
      <div>
        <strong>{item.userName}</strong>
        <small>
          {item.role === "ORGANIZER"
            ? "Organiza el plan"
            : item.status === "INVITED"
              ? "Invitación pendiente"
              : "Parte del grupo"}
        </small>
        {note && <small>Nota: {note}</small>}
      </div>
      <span className={"participant-response " + (commitment ?? "")}>
        {item.status === "INVITED"
          ? "Aún no se une"
          : commitment
            ? commitmentLabels[commitment]
            : "Sin respuesta"}
      </span>
      {canRemove && (
        <Button
          variant="quiet"
          aria-label={"Retirar a " + item.userName}
          busy={busy}
          onClick={onRemove}
        >
          <Trash2 size={17} />
        </Button>
      )}
    </div>
  );
}
export function OptionCard({
  option,
  coverage,
  canVote,
  canDelete,
  onVote,
  onDelete,
  busy,
}: {
  option: PlanOption;
  coverage?: Geography;
  canVote: boolean;
  canDelete: boolean;
  onVote: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <article className={"option-card " + (option.selected ? "selected" : "")}>
      <div className="option-title">
        {option.type === "PLACE" ? (
          <MapPin size={20} />
        ) : (
          <CalendarDays size={20} />
        )}
        <h3>{option.label}</h3>
        {option.selected && (
          <span className="badge good">
            <Check size={14} />
            Elegida
          </span>
        )}
      </div>
      {option.description && <p>{option.description}</p>}
      {option.type === "DATE" ? (
        <p className="option-main">{formatOptionDate(option)}</p>
      ) : (
        <>
          <p className="option-main">
            {option.location?.address ?? "Ubicación en el mapa"}
          </p>
          {option.estimateStatus === "READY" ? (
            <p className="travel-estimate">
              Promedio estimado: {option.avgDistanceKm?.toFixed(1)} km ·{" "}
              {Math.round(option.avgTravelMinutes ?? 0)} min
              <small>
                {option.estimateSource === "ROUTING"
                  ? "Estimación de rutas"
                  : option.estimateSource === "HAVERSINE"
                    ? "Aproximación en línea recta; no es una ruta de tránsito"
                    : "Estimación guardada; origen no disponible"}
              </small>
              <small>
                {coverage
                  ? `Calculado con ${coverage.locatedParticipants} de ${coverage.joinedParticipants} ubicaciones de referencia del grupo.`
                  : "Calculado con las ubicaciones de referencia disponibles."}
              </small>
            </p>
          ) : (
            <p className="form-hint">
              {option.estimateStatus === "PENDING"
                ? "Calculando estimación…"
                : "Sin estimación: aún faltan ubicaciones del grupo."}
            </p>
          )}
        </>
      )}
      <div className="option-footer">
        <span>
          {option.voteCount} {option.voteCount === 1 ? "voto" : "votos"} · Por{" "}
          {option.proposedByName}
        </span>
        <div className="actions">
          {canDelete && (
            <Button
              variant="quiet"
              aria-label={"Eliminar propuesta " + option.label}
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </Button>
          )}
          {canVote && (
            <Button
              variant="secondary"
              className={option.hasVoted ? "is-selected" : ""}
              busy={busy}
              onClick={onVote}
              aria-pressed={option.hasVoted}
            >
              {option.hasVoted ? <Check size={17} /> : <ThumbsUp size={17} />}
              {option.hasVoted ? "Votaste · Quitar voto" : "Votar"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

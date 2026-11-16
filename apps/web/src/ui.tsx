import {
  Component,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type ErrorInfo,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  LoaderCircle,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "@qsale/api-client";
import {
  feasibilityLabels,
  planStatusLabels,
  type Feasibility,
  type Plan,
} from "@qsale/contracts";

let pointerInteraction = false;

export function Button({
  children,
  busy,
  variant = "primary",
  className = "",
  disabled,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary" | "quiet" | "danger" | "selected";
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      {...props}
      onPointerDown={(event) => {
        if (!busy && !disabled)
          event.currentTarget.dataset.pointerPressed = "true";
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        delete event.currentTarget.dataset.pointerPressed;
        onPointerUp?.(event);
      }}
      onPointerLeave={(event) => {
        delete event.currentTarget.dataset.pointerPressed;
        onPointerLeave?.(event);
      }}
      onPointerCancel={(event) => {
        delete event.currentTarget.dataset.pointerPressed;
        onPointerCancel?.(event);
      }}
      onKeyDown={(event) => {
        delete event.currentTarget.dataset.pointerPressed;
        onKeyDown?.(event);
      }}
    >
      {busy && <LoaderCircle size={18} className="spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? id + "-help" : undefined}
      />
      {(error || hint) && (
        <small className={error ? "field-error" : ""} id={id + "-help"}>
          {error ?? hint}
        </small>
      )}
    </div>
  );
}
export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select {...props} id={id}>
        {children}
      </select>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  const status = error instanceof ApiError ? error.status : 500;
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <div>
        <h2>
          {status === 404
            ? "Aquí no hay un plan"
            : status === 403
              ? "Este espacio es privado"
              : "No pudimos cargar esta parte"}
        </h2>
        <p>{error.message}</p>
        <div className="actions">
          {retry && (
            <Button variant="secondary" onClick={retry}>
              Volver a intentar
            </Button>
          )}
          {[403, 404].includes(status) && (
            <Link to="/plans">Ir a mis planes</Link>
          )}
        </div>
      </div>
    </div>
  );
}
export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" role="status" aria-label="Cargando contenido">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} />
      ))}
    </div>
  );
}
export function StatusBadge({ plan }: { plan: Plan }) {
  return (
    <span
      className={
        "badge " +
        (plan.status === "CANCELLED"
          ? "muted"
          : plan.status === "CLOSED"
            ? "good"
            : "warm")
      }
    >
      {planStatusLabels[plan.status]}
    </span>
  );
}
export function FeasibilityIndicator({ value }: { value: Feasibility }) {
  const checks = [
    {
      ready: value.confirmedParticipants >= value.minParticipants,
      label: `${value.confirmedParticipants} de ${value.minParticipants} confirmaciones mínimas`,
    },
    {
      ready: value.dateReady,
      label: value.dateReady
        ? "Fecha vigente con votos"
        : "Falta elegir una fecha vigente",
    },
    {
      ready: value.placeReady,
      label: value.placeReady
        ? "Lugar con votos"
        : "Falta proponer y votar un lugar",
    },
  ];
  return (
    <div className="feasibility">
      <strong>{feasibilityLabels[value.status]}</strong>
      <ul className="readiness-list">
        {checks.map(({ ready, label }) => (
          <li key={label} data-ready={ready}>
            {ready ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <Circle size={15} aria-hidden="true" />
            )}
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <details className="score-details">
        <summary>Cómo va el acuerdo</summary>
        <p>
          Índice de coordinación: {value.score} %. Considera las respuestas,
          propuestas, votos y disponibilidad; no es el porcentaje de asistencia.
        </p>
        <meter
          min={0}
          max={100}
          value={value.score}
          aria-label="Índice de coordinación del plan"
        />
      </details>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}
export function Pagination({
  page,
  size,
  totalElements,
  totalPages,
  onChange,
}: {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  onChange: (page: number, size: number) => void;
}) {
  const pages = Array.from(
    new Set(
      [0, page - 1, page, page + 1, totalPages - 1].filter(
        (value) => value >= 0 && value < totalPages,
      ),
    ),
  ).sort((a, b) => a - b);
  const showSizeSelector = size > 10 || totalElements > 10;
  if (totalPages <= 1 && !showSizeSelector)
    return totalElements ? (
      <p className="results-count">
        {totalElements} {totalElements === 1 ? "resultado" : "resultados"}
      </p>
    ) : null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <span aria-live="polite">
        {totalElements ? page * size + 1 : 0}–
        {Math.min((page + 1) * size, totalElements)} de {totalElements}
      </span>
      {totalPages > 1 && (
        <div className="page-buttons">
          <Button
            variant="quiet"
            aria-label="Página anterior"
            disabled={page <= 0}
            onClick={() => onChange(page - 1, size)}
          >
            <ArrowLeft size={18} />
          </Button>
          {pages.map((value, index) => (
            <span key={value}>
              {index > 0 && value > pages[index - 1]! + 1 && (
                <span className="ellipsis">…</span>
              )}
              <button
                className="page-number"
                aria-current={value === page ? "page" : undefined}
                onClick={() => onChange(value, size)}
              >
                {value + 1}
              </button>
            </span>
          ))}
          <Button
            variant="quiet"
            aria-label="Página siguiente"
            disabled={page + 1 >= totalPages}
            onClick={() => onChange(page + 1, size)}
          >
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
      {showSizeSelector && (
        <label>
          Por página{" "}
          <select
            aria-label="Elementos por página"
            value={size}
            onChange={(event) => onChange(0, Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [trigger] = useState(() => document.activeElement as HTMLElement | null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [animate] = useState(
    () =>
      pointerInteraction &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      clearTimeout(closeTimer.current);
      dialog?.close();
      if (trigger?.isConnected && document.activeElement !== trigger)
        trigger.focus();
    };
  }, [trigger]);
  const close = (immediate = false) => {
    if (!dismissible) return;
    if (immediate || !animate) {
      clearTimeout(closeTimer.current);
      onClose();
      return;
    }
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 160);
  };
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      data-motion={animate}
      data-closing={closing}
      onCancel={(event) => {
        event.preventDefault();
        close(true);
      }}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          disabled={!dismissible}
          onClick={() => close()}
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  action,
  busy,
  onConfirm,
  onClose,
  intent = "default",
}: {
  title: string;
  description: string;
  action: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  intent?: "default" | "danger";
}) {
  return (
    <Dialog
      title={title}
      dismissible={!busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>{description}</p>
      <div className="actions end">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Volver
        </Button>
        <Button
          type="button"
          variant={intent === "danger" ? "danger" : "primary"}
          busy={busy}
          onClick={onConfirm}
        >
          {action}
        </Button>
      </div>
    </Dialog>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
    id: number;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    const pointer = () => {
      pointerInteraction = true;
    };
    const keyboard = () => {
      pointerInteraction = false;
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
      clearTimeout(closeTimer.current);
    };
  }, []);
  const dismiss = () => {
    clearTimeout(closeTimer.current);
    if (
      !pointerInteraction ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setToast(null);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setToast(null);
      setClosing(false);
    }, 160);
  };
  useEffect(() => {
    if (!toast || toast.error || paused) return;
    const timeout = setTimeout(dismiss, 5000);
    return () => clearTimeout(timeout);
  }, [toast, paused]);
  return (
    <ToastContext
      value={(message, error = false) => {
        clearTimeout(closeTimer.current);
        setClosing(false);
        setPaused(false);
        setToast({ message, error, id: ++counter.current });
      }}
    >
      {children}
      {toast && (
        <div
          key={toast.id}
          className={"toast " + (toast.error ? "toast-error" : "")}
          role={toast.error ? "alert" : "status"}
          data-closing={closing}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setPaused(false);
          }}
        >
          {toast.error ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={dismiss}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </ToastContext>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    return this.state.failed ? (
      <main className="standalone">
        <EmptyState
          title="Esta pantalla necesita volver a cargar"
          action={
            <Button onClick={() => location.reload()}>Recargar Quesale</Button>
          }
        >
          Tus cambios guardados siguen en tu cuenta.
        </EmptyState>
      </main>
    ) : (
      this.props.children
    );
  }
}

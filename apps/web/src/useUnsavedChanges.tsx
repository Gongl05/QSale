import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { ConfirmDialog } from "./ui";

const drafts = new Map<string, boolean>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const hasDrafts = () => [...drafts.values()].some(Boolean);
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function UnsavedChangesNavigationGuard() {
  useSyncExternalStore(subscribe, hasDrafts, () => false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasDrafts() &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );
  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (hasDrafts()) {
        event.preventDefault();
        event.returnValue = "";
      }
    }, []),
  );
  return blocker.state === "blocked" ? (
    <ConfirmDialog
      title="¿Descartar los cambios sin guardar?"
      description="Puedes seguir editando o salir de esta página y descartar los borradores sin guardar."
      action="Descartar cambios"
      intent="danger"
      busy={false}
      onClose={() => blocker.reset()}
      onConfirm={() => {
        drafts.clear();
        notify();
        blocker.proceed();
      }}
    />
  ) : null;
}

export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allowed = useRef(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!dirty) allowed.current = false;
    drafts.set(id, dirty && !allowed.current);
    notify();
    return () => {
      drafts.delete(id);
      notify();
    };
  }, [dirty, id]);
  return {
    allowNavigation: () => {
      allowed.current = true;
      drafts.delete(id);
      notify();
    },
    confirmDiscard: (run: () => void) => {
      if (!dirtyRef.current) run();
      else setDiscard(() => run);
    },
    dialog: discard ? (
      <ConfirmDialog
        title="¿Descartar los cambios sin guardar?"
        description="Puedes seguir editando o descartar este borrador. Lo que ya guardaste se conserva."
        action="Descartar cambios"
        intent="danger"
        busy={false}
        onClose={() => {
          setDiscard(null);
        }}
        onConfirm={() => {
          discard();
          setDiscard(null);
        }}
      />
    ) : null,
  };
}

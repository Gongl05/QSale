import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Alert, Platform } from "react-native";

const DraftContext = createContext({
  dirty: false,
  register: (_id: string, _dirty: boolean) => {},
});
export function DraftBoundary({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  const register = useCallback((id: string, dirty: boolean) => {
    setDrafts((current) => {
      if (Boolean(current[id]) === dirty) return current;
      const next = { ...current };
      if (dirty) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);
  return (
    <DraftContext value={{ dirty: Object.keys(drafts).length > 0, register }}>
      {children}
    </DraftContext>
  );
}
export function useRegisterDraft(dirty: boolean) {
  const id = useId();
  const { register } = useContext(DraftContext);
  useEffect(() => {
    register(id, dirty);
    return () => register(id, false);
  }, [id, dirty, register]);
}
export function useDraftConfirmation() {
  const { dirty } = useContext(DraftContext);
  return (action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    if (Platform.OS === "web") {
      if (window.confirm("Tienes cambios sin guardar. ¿Quieres descartarlos?"))
        action();
    } else
      Alert.alert(
        "Cambios sin guardar",
        "Se descartarán los cambios de esta sección.",
        [
          { text: "Seguir editando", style: "cancel" },
          { text: "Descartar cambios", style: "destructive", onPress: action },
        ],
      );
  };
}

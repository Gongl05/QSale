import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { usePreventRemove } from "expo-router";

import { useRegisterDraft } from "./drafts";

export function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [discarded, setDiscarded] = useState(false);
  useEffect(() => {
    if (!dirty) setDiscarded(false);
  }, [dirty]);
  useRegisterDraft(dirty && !discarded);
  const disablePrevention = usePreventRemove(
    dirty && !discarded,
    ({ repeat }) => {
      if (!dirtyRef.current) {
        repeat();
        return;
      }
      const leave = () => {
        setDiscarded(true);
        repeat();
      };
      if (Platform.OS === "web") {
        if (
          window.confirm("Tienes cambios sin guardar. ¿Quieres descartarlos?")
        )
          leave();
      } else {
        Alert.alert(
          "Cambios sin guardar",
          "Si sales, se descartarán los cambios de este formulario.",
          [
            { text: "Seguir editando", style: "cancel" },
            { text: "Descartar cambios", style: "destructive", onPress: leave },
          ],
        );
      }
    },
  );
  return () => {
    setDiscarded(true);
    disablePrevention();
  };
}

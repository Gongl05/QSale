import {
  Component,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@expo/vector-icons/Feather";
import { useNetInfo } from "@react-native-community/netinfo";
import { ApiError, isCanceledRequest } from "@qsale/api-client";
import {
  palette,
  type ThemeColors,
} from "../../../packages/design-tokens/src/index";

import { DraftBoundary, useDraftConfirmation } from "./drafts";

const font = Platform.OS === "ios" ? "System" : "Manrope_500Medium";
const strong = Platform.OS === "ios" ? "System" : "Manrope_600SemiBold";
function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: {
      padding: 20,
      paddingBottom: 32,
      gap: 20,
      maxWidth: 840,
      width: "100%",
      alignSelf: "center",
    },
    title: {
      fontSize: 28,
      lineHeight: 36,
      fontFamily: strong,
      fontWeight: "600",
      letterSpacing: -0.6,
      color: c.ink,
    },
    subtitle: { fontSize: 15, lineHeight: 23, color: c.muted },
    heading: {
      fontSize: 21,
      lineHeight: 29,
      fontFamily: strong,
      fontWeight: "600",
      color: c.ink,
    },
    subheading: {
      fontSize: 17,
      lineHeight: 25,
      fontFamily: strong,
      fontWeight: "600",
      color: c.ink,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    surface: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 20,
      gap: 16,
    },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 4 },
    body: { color: c.ink, fontFamily: font, fontSize: 17, lineHeight: 26 },
    muted: { color: c.muted, fontSize: 13, lineHeight: 20 },
    error: {
      color: c.danger,
      backgroundColor: c.dangerSoft,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
      lineHeight: 22,
    },
    field: { gap: 8 },
    label: {
      fontSize: 14,
      lineHeight: 21,
      fontFamily: strong,
      fontWeight: "600",
      color: c.ink,
    },
    input: {
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: c.surface,
      fontFamily: font,
      fontSize: 16,
      lineHeight: 24,
      color: c.ink,
      minHeight: 48,
    },
    button: {
      minHeight: 48,
      minWidth: 48,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.accent,
    },
    buttonSecondary: { backgroundColor: c.surface, borderColor: c.border },
    buttonQuiet: { backgroundColor: "transparent", borderColor: "transparent" },
    buttonDanger: { backgroundColor: c.dangerSoft, borderColor: c.danger },
    buttonText: {
      fontFamily: strong,
      fontWeight: "600",
      fontSize: 15,
      lineHeight: 22,
      color: c.accentInk,
      textAlign: "center",
      flexShrink: 1,
    },
    buttonTextSecondary: { color: c.ink },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: c.raised,
      alignSelf: "flex-start",
    },
    badgeText: {
      color: c.muted,
      fontFamily: font,
      fontSize: 12,
      lineHeight: 18,
    },
    empty: {
      paddingVertical: 32,
      paddingHorizontal: 12,
      gap: 12,
      alignItems: "flex-start",
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.raised,
      alignItems: "center",
      justifyContent: "center",
    },
    tab: {
      minHeight: 48,
      minWidth: 48,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: c.raised,
    },
    tabActive: { backgroundColor: c.cream },
    toast: {
      position: "absolute",
      left: 16,
      right: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    note: { padding: 16, borderRadius: 10, backgroundColor: c.raised, gap: 12 },
    planStrip: {
      padding: 16,
      backgroundColor: c.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    planBody: { padding: 20, gap: 12 },
    statRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    link: { color: c.link, fontFamily: font, textDecorationLine: "underline" },
    option: {
      backgroundColor: c.surface,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      gap: 12,
    },
    map: {
      height: 280,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    code: {
      fontSize: 24,
      letterSpacing: 2,
      fontFamily: strong,
      textAlign: "center",
      color: c.ink,
    },
    loader: {
      padding: 40,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    offline: { backgroundColor: c.cream, padding: 12 },
    counter: { fontVariant: ["tabular-nums"] },
  });
}
const themes = {
  light: {
    colors: palette.light,
    styles: createStyles(palette.light),
    dark: false,
  },
  dark: {
    colors: palette.dark,
    styles: createStyles(palette.dark),
    dark: true,
  },
};
export function useUI() {
  return useColorScheme() === "dark" ? themes.dark : themes.light;
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduced(v);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
export function Text({ style, ...props }: TextProps) {
  const { styles } = useUI();
  return <NativeText {...props} style={[styles.body, style]} />;
}
export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  safeTop = false,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  safeTop?: boolean;
}) {
  const { styles, colors } = useUI();
  const network = useNetInfo();
  return (
    <DraftBoundary>
      <SafeAreaView
        edges={
          safeTop
            ? ["top", "left", "right", "bottom"]
            : ["left", "right", "bottom"]
        }
        style={styles.screen}
      >
        {(network.isConnected === false ||
          network.isInternetReachable === false) && (
          <View style={styles.offline}>
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              Estás sin conexión. Lo cargado sigue disponible; conéctate para
              guardar cambios.
            </Text>
          </View>
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll ? (
            <ScrollView
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={Boolean(refreshing)}
                    onRefresh={onRefresh}
                    tintColor={colors.link}
                  />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DraftBoundary>
  );
}
export function Heading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { styles } = useUI();
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {Boolean(description) && (
        <Text style={styles.subtitle}>{description}</Text>
      )}
    </View>
  );
}
export function Button({
  children,
  onPress,
  busy,
  disabled,
  variant = "primary",
  icon,
  style,
  selected,
  accessibilityHint,
}: {
  children: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: React.ComponentProps<typeof Feather>["name"];
  style?: ViewStyle;
  selected?: boolean;
  accessibilityHint?: string;
}) {
  const { styles, colors } = useUI();
  const secondary = variant === "secondary" || variant === "quiet";
  const ink =
    variant === "danger"
      ? colors.danger
      : secondary
        ? colors.ink
        : colors.accentInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: Boolean(busy || disabled),
        busy: Boolean(busy),
        ...(selected !== undefined ? { selected } : {}),
      }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "quiet" && styles.buttonQuiet,
        variant === "danger" && styles.buttonDanger,
        (busy || disabled) && { opacity: 0.5 },
        pressed && { opacity: 0.78 },
        selected && { borderColor: colors.link },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={ink} />
      ) : icon ? (
        <Feather
          accessible={false}
          accessibilityElementsHidden
          name={icon}
          size={18}
          color={ink}
        />
      ) : null}
      <Text style={[styles.buttonText, { color: ink }]}>{children}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { styles, colors } = useUI();
  const id = useId();
  return (
    <View style={styles.field}>
      <Text nativeID={id + "-label"} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ? `Error: ${error}` : hint}
        accessibilityLabelledBy={id + "-label"}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? id + "-help" : undefined}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        returnKeyType={props.multiline ? "default" : "done"}
        {...props}
        style={[styles.input, error && { borderColor: colors.danger }, style]}
      />
      {(error || hint) && (
        <Text
          nativeID={id + "-help"}
          accessibilityRole={error ? "alert" : undefined}
          accessibilityLiveRegion={error ? "polite" : undefined}
          style={[styles.muted, error && { color: colors.danger }]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
export function Loading({ label = "Cargando…" }: { label?: string }) {
  const { styles, colors } = useUI();
  return (
    <View style={styles.loader} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.link} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  const { styles, colors } = useUI();
  return (
    <View style={styles.empty}>
      <Feather name="alert-circle" size={24} color={colors.danger} />
      <Text accessibilityRole="alert" style={styles.error}>
        {error.message}
      </Text>
      {retry && (
        <Button variant="secondary" onPress={retry}>
          Volver a intentar
        </Button>
      )}
    </View>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: string;
}) {
  const { styles } = useUI();
  return (
    <View style={styles.empty}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.subtitle}>{children}</Text>
    </View>
  );
}
export function Badge({
  children,
  good = false,
}: {
  children: string;
  good?: boolean;
}) {
  const { styles, colors } = useUI();
  return (
    <View style={[styles.badge, good && { backgroundColor: colors.greenSoft }]}>
      <Text style={[styles.badgeText, good && { color: colors.green }]}>
        {children}
      </Text>
    </View>
  );
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  selection = false,
}: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  selection?: boolean;
}) {
  const { styles, colors } = useUI();
  const confirmDraft = useDraftConfirmation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {items.map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole={selection ? "radio" : "tab"}
          accessibilityState={
            selection ? { checked: value === key } : { selected: value === key }
          }
          onPress={() => {
            if (key === value) return;
            selection ? onChange(key) : confirmDraft(() => onChange(key));
          }}
          style={[styles.tab, value === key && styles.tabActive]}
        >
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              fontFamily: font,
              color: value === key ? colors.link : colors.muted,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Choice<T extends string>(props: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return <Tabs {...props} selection />;
}
export function Disclosure({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const { styles, colors } = useUI();
  return (
    <View style={{ gap: open ? 16 : 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[styles.between, { minHeight: 48 }]}
      >
        <Text style={styles.label}>{title}</Text>
        <Feather accessible={false} accessibilityElementsHidden
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.muted}
        />
      </Pressable>
      {open && children}
    </View>
  );
}
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { styles, colors } = useUI();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      transparent
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "90%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 20,
          }}
        >
          <View style={[styles.between, { marginBottom: 16 }]}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { flex: 1 }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              style={{
                minHeight: 48,
                minWidth: 48,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  const { styles } = useUI();
  if (totalPages <= 1) return null;
  return (
    <View style={{ gap: 12, paddingTop: 16 }}>
      <View style={styles.between}>
        <Button
          variant="secondary"
          disabled={page === 0}
          onPress={() => onChange(page - 1, size)}
        >
          Anterior
        </Button>
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {page + 1} de {totalPages}
        </Text>
        <Button
          variant="secondary"
          disabled={page + 1 >= totalPages}
          onPress={() => onChange(page + 1, size)}
        >
          Siguiente
        </Button>
      </View>
      <Text style={styles.muted}>
        {page * size + 1}–{Math.min((page + 1) * size, totalElements)} de{" "}
        {totalElements}
      </Text>
    </View>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const nextToastId = useRef(0);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
    id: number;
  } | null>(null);
  const { styles, colors } = useUI();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 200,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== "web",
    }).start();
    AccessibilityInfo.announceForAccessibility(toast.message);
    if (!toast.error) {
      const timeout =
        Platform.OS === "android"
          ? AccessibilityInfo.getRecommendedTimeoutMillis(5000)
          : Promise.resolve(5000);
      void timeout.then((ms) => {
        if (active) timer = setTimeout(() => dismiss(toast.id), ms);
      });
    }
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [toast, reduced]);
  function dismiss(id: number) {
    Animated.timing(progress, {
      toValue: 0,
      duration: reduced ? 0 : 160,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished)
        setToast((current) => (current?.id === id ? null : current));
    });
  }
  return (
    <ToastContext
      value={(message, error = false) =>
        setToast({ message, error, id: ++nextToastId.current })
      }
    >
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            {
              bottom: Math.max(insets.bottom + 80, keyboardHeight + 16),
              opacity: progress,
              transform: [
                {
                  translateY: reduced
                    ? 0
                    : progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                },
              ],
            },
          ]}
        >
          <Feather
            name={toast.error ? "alert-circle" : "check"}
            color={toast.error ? colors.danger : colors.green}
            size={20}
          />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 22 }}>
            {toast.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            onPress={() => dismiss(toast.id)}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
        </Animated.View>
      )}
    </ToastContext>
  );
}
export function useAction<T>(
  action: (input: T) => Promise<unknown>,
  message: string,
  after?: () => void,
) {
  const cache = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await cache.invalidateQueries();
      toast(message);
      after?.();
    },
    onError: (error: Error) => {
      if (isCanceledRequest(error)) return;
      if (error instanceof ApiError && [403, 404, 409].includes(error.status))
        void cache.invalidateQueries();
      toast(error.message, true);
    },
  });
}
export function confirmAction(
  title: string,
  description: string,
  action: () => void,
  label = "Confirmar",
  destructive = false,
) {
  if (Platform.OS === "web") {
    if (window.confirm(title + "\n\n" + description)) action();
    return;
  }
  Alert.alert(title, description, [
    { text: "Cancelar", style: "cancel" },
    {
      text: label,
      style: destructive ? "destructive" : "default",
      onPress: action,
    },
  ]);
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Screen>
        <EmptyState title="No pudimos abrir esta pantalla">
          Tus datos guardados siguen en tu cuenta. Cierra y vuelve a abrir
          QSale.
        </EmptyState>
      </Screen>
    ) : (
      this.props.children
    );
  }
}

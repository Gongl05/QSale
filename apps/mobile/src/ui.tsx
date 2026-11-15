import { Component, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { useNetInfo } from '@react-native-community/netinfo';
import { ApiError, isCanceledRequest } from '@qsale/api-client';

export const colors = {
  ink: '#1E293B',
  muted: '#626777',
  accent: '#C64B08',
  orange: '#FF8224',
  cream: '#FFF3DD',
  background: '#F9F8F5',
  border: '#E7E5DF',
  green: '#16644A',
  danger: '#A22B31',
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 22,
    paddingBottom: 40,
    gap: 18,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -1.1,
    color: colors.ink,
  },
  subtitle: { fontSize: 14, lineHeight: 23, color: colors.muted },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subheading: { fontSize: 16, lineHeight: 24, fontFamily: 'Manrope_700Bold', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  surface: {
    backgroundColor: '#fff',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  body: {
    color: colors.ink,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Manrope_500Medium',
    fontSize: 17,
    lineHeight: 25,
  },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  error: {
    color: colors.danger,
    backgroundColor: '#FFF0EF',
    padding: 13,
    borderRadius: 9,
    fontSize: 13,
    lineHeight: 21,
  },
  field: { gap: 7 },
  label: { fontSize: 13, fontFamily: 'Manrope_700Bold', color: colors.ink },
  input: {
    borderColor: '#D6D5CE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: colors.ink,
    minHeight: 48,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonSecondary: { backgroundColor: '#fff', borderColor: '#D7D6D0' },
  buttonQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  buttonText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
  },
  buttonTextSecondary: { color: colors.ink },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.cream,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#8A430E', fontFamily: 'Manrope_700Bold', fontSize: 11 },
  empty: {
    padding: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D4CDC0',
    borderRadius: 15,
    gap: 12,
    backgroundColor: '#FFFDF8',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9E4CF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#EEECE6',
  },
  tabActive: { backgroundColor: '#FAE7D5' },
  toast: {
    position: 'absolute',
    bottom: 30,
    left: 18,
    right: 18,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E3C31',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  note: { padding: 15, borderRadius: 10, backgroundColor: colors.cream },
  planStrip: {
    padding: 20,
    backgroundColor: colors.cream,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  planBody: { padding: 20, gap: 12 },
  statRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  link: { color: colors.accent, fontFamily: 'Manrope_700Bold', textDecorationLine: 'underline' },
  option: {
    backgroundColor: '#fff',
    padding: 19,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 12,
  },
  map: {
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: {
    fontSize: 25,
    letterSpacing: 3,
    fontFamily: 'Manrope_800ExtraBold',
    textAlign: 'center',
    color: colors.ink,
  },
  loader: { padding: 50, alignItems: 'center', justifyContent: 'center', gap: 14 },
  offline: { backgroundColor: '#FFF3DD', padding: 12 },
  counter: { fontVariant: ['tabular-nums'] },
});
export function Text({ style, ...props }: TextProps) {
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
  const network = useNetInfo();
  return (
    <SafeAreaView
      edges={safeTop ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
      style={styles.screen}
    >
      {(network.isConnected === false || network.isInternetReachable === false) && (
        <View style={styles.offline}>
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            Estás sin conexión. Puedes ver lo cargado; vuelve a conectarte para guardar cambios.
          </Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.accent}
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
  );
}
export function Heading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ gap: 10, marginBottom: 5 }}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {Boolean(description) && <Text style={styles.subtitle}>{description}</Text>}
    </View>
  );
}
export function Button({
  children,
  onPress,
  busy,
  disabled,
  variant = 'primary',
  icon,
  style,
}: {
  children: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: React.ComponentProps<typeof Feather>['name'];
  style?: ViewStyle;
}) {
  const secondary = variant === 'secondary' || variant === 'quiet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: Boolean(busy || disabled), busy: Boolean(busy) }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        variant === 'danger' && styles.buttonDanger,
        (busy || disabled) && { opacity: 0.5 },
        pressed && { opacity: 0.78 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={secondary ? colors.accent : '#fff'} />
      ) : icon ? (
        <Feather
          accessible={false}
          accessibilityElementsHidden
          name={icon}
          size={17}
          color={secondary ? colors.ink : '#fff'}
        />
      ) : null}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{children}</Text>
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#737582"
        {...props}
        style={[styles.input, error && { borderColor: colors.danger }, style]}
      />
      {(error || hint) && (
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          style={[styles.muted, error && { color: colors.danger }]}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.loader} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <View style={styles.empty}>
      <Feather name="alert-circle" size={25} color={colors.danger} />
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
export function EmptyState({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.subtitle}>{children}</Text>
    </View>
  );
}
export function Badge({ children, good = false }: { children: string; good?: boolean }) {
  return (
    <View style={[styles.badge, good && { backgroundColor: '#E6F2EB' }]}>
      <Text style={[styles.badgeText, good && { color: colors.green }]}>{children}</Text>
    </View>
  );
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {items.map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          style={[styles.tab, value === key && styles.tabActive]}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Manrope_700Bold',
              color: value === key ? '#8B3C0C' : colors.muted,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
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
  const pages = [
    ...new Set(
      [0, page - 1, page, page + 1, totalPages - 1].filter(
        (value) => value >= 0 && value < totalPages,
      ),
    ),
  ].sort((a, b) => a - b);
  return (
    <View style={{ gap: 14, paddingTop: 15 }}>
      <View style={styles.between}>
        <Text style={styles.muted}>
          {totalElements ? page * size + 1 : 0}–{Math.min((page + 1) * size, totalElements)} de{' '}
          {totalElements}
        </Text>
        <Text style={styles.muted}>Por página</Text>
      </View>
      <Tabs
        items={([10, 25, 50, 100] as const).map((value) => [String(value), String(value)] as const)}
        value={String(size)}
        onChange={(value) => onChange(0, Number(value))}
      />
      <View style={[styles.row, { justifyContent: 'center', gap: 6 }]}>
        <Button variant="quiet" disabled={page === 0} onPress={() => onChange(page - 1, size)}>
          Anterior
        </Button>
        {pages.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={'Página ' + (value + 1)}
            accessibilityState={{ selected: value === page }}
            style={[styles.tab, value === page && styles.tabActive]}
            onPress={() => onChange(value, size)}
          >
            <Text style={{ fontSize: 12 }}>{value + 1}</Text>
          </Pressable>
        ))}
        <Button
          variant="quiet"
          disabled={page + 1 >= totalPages}
          onPress={() => onChange(page + 1, size)}
        >
          Siguiente
        </Button>
      </View>
    </View>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; error: boolean; id: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 10000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext value={(message, error = false) => setToast({ message, error, id: Date.now() })}>
      {children}
      {toast && (
        <Pressable
          accessibilityRole={toast.error ? 'alert' : 'text'}
          accessibilityLiveRegion="polite"
          onPress={() => setToast(null)}
          style={[styles.toast, toast.error && { backgroundColor: '#862D2F' }]}
        >
          <Feather name={toast.error ? 'alert-circle' : 'check'} color="#fff" size={20} />
          <Text style={{ color: '#fff', flex: 1, fontSize: 13 }}>{toast.message}</Text>
          <Feather name="x" size={18} color="#fff" />
        </Pressable>
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
  label = 'Confirmar',
) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n\n' + description)) action();
    return;
  }
  Alert.alert(title, description, [
    { text: 'Volver', style: 'cancel' },
    { text: label, style: 'destructive', onPress: action },
  ]);
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Screen>
        <EmptyState title="Esta pantalla necesita volver a cargar">
          Tus cambios guardados siguen en tu cuenta. Cierra y vuelve a abrir QSale.
        </EmptyState>
      </Screen>
    ) : (
      this.props.children
    );
  }
}

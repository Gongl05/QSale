import { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '@qsale/contracts';
import { Button, Field, Text, colors, styles } from './ui';

function selectedDate(value: string, mode: 'date' | 'time') {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const parsed = new Date(
    mode === 'date' ? value + 'T12:00:00-05:00' : today + 'T' + value + ':00-05:00',
  );
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function serialize(date: Date, mode: 'date' | 'time') {
  return mode === 'date'
    ? date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
    : new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Lima',
      }).format(date);
}
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  error,
  optional = true,
  maximumDate,
  formatValue = formatDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  error?: string;
  optional?: boolean;
  maximumDate?: Date;
  formatValue?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Date());
  if (Platform.OS === 'web')
    return (
      <Field
        label={label + (mode === 'date' ? ' (AAAA-MM-DD)' : ' (HH:mm)')}
        value={value}
        onChangeText={onChange}
        error={error}
        placeholder={mode === 'date' ? '2026-12-12' : '17:00'}
        maxLength={mode === 'date' ? 10 : 5}
      />
    );
  const picker = (
    <DateTimePicker
      value={draft}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      timeZoneName="America/Lima"
      maximumDate={maximumDate}
      locale="es-PE"
      themeVariant="light"
      textColor={colors.ink}
      onValueChange={(_event, date) => {
        if (Platform.OS === 'android') {
          setOpen(false);
          onChange(serialize(date, mode));
        } else if (date) setDraft(date);
      }}
      onDismiss={() => setOpen(false)}
    />
  );
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Button
        variant="secondary"
        icon={mode === 'date' ? 'calendar' : 'clock'}
        onPress={() => {
          setDraft(selectedDate(value, mode));
          setOpen(true);
        }}
      >
        {value
          ? mode === 'date'
            ? formatValue(value)
            : value
          : mode === 'date'
            ? 'Elegir fecha'
            : 'Elegir hora'}
      </Button>
      {optional && value && (
        <Button variant="quiet" onPress={() => onChange('')}>
          {'Quitar ' + (mode === 'date' ? 'fecha' : 'hora')}
        </Button>
      )}
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={[styles.muted, { color: colors.danger }]}>
          {error}
        </Text>
      )}
      {open &&
        (Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#1E293B55' }}>
              <View
                accessibilityViewIsModal
                style={{
                  backgroundColor: '#fff',
                  padding: 22,
                  paddingBottom: 42,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}
              >
                <Text style={styles.subheading}>{label}</Text>
                {picker}
                <View style={styles.row}>
                  <Button variant="secondary" onPress={() => setOpen(false)}>
                    Volver
                  </Button>
                  <Button
                    onPress={() => {
                      onChange(serialize(draft, mode));
                      setOpen(false);
                    }}
                  >
                    {'Elegir ' + (mode === 'date' ? 'fecha' : 'hora')}
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          picker
        ))}
    </View>
  );
}

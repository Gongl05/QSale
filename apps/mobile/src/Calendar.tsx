import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { formatDate, todayInLima } from '@qsale/contracts';
import { Button, Tabs, Text, colors, styles } from './ui';

const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** "2026-11" → previous/next month in the same format. */
export function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Days of the month laid out Monday-first, with nulls as padding before the 1st. */
function monthCells(month: string) {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1)).getUTCDay(); // 0 = Sunday
  const total = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const cells: (string | null)[] = Array((first + 6) % 7).fill(null);
  for (let day = 1; day <= total; day++) cells.push(isoDay(year, index - 1, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function monthTitle(month: string) {
  const text = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-15T00:00:00Z'));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface DayMark {
  color: string;
}

/** A month view. Selection, ranges and dots are decided by the caller. */
export function MonthGrid({
  month,
  onMonthChange,
  onPressDay,
  selected,
  inRange,
  disabled,
  marks,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onPressDay?: (day: string) => void;
  selected?: (day: string) => boolean;
  inRange?: (day: string) => boolean;
  disabled?: (day: string) => boolean;
  marks?: (day: string) => DayMark[];
}) {
  const today = todayInLima();
  const cells = monthCells(month);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.between}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          hitSlop={12}
          onPress={() => onMonthChange(shiftMonth(month, -1))}
          style={{ padding: 8 }}
        >
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.subheading}>{monthTitle(month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          hitSlop={12}
          onPress={() => onMonthChange(shiftMonth(month, 1))}
          style={{ padding: 8 }}
        >
          <Feather name="chevron-right" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {weekdays.map((day, index) => (
          <Text key={index} style={[styles.muted, { flex: 1, textAlign: 'center' }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, index) => {
          if (!day) return <View key={'pad' + index} style={{ width: '14.2857%', height: 46 }} />;
          const off = disabled?.(day) ?? false;
          const isSelected = selected?.(day) ?? false;
          const band = inRange?.(day) ?? false;
          const dots = marks?.(day) ?? [];
          return (
            <View
              key={day}
              style={{
                width: '14.2857%',
                height: 46,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: band ? '#FAE7D5' : undefined,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={formatDate(day)}
                accessibilityState={{ disabled: off, selected: isSelected }}
                disabled={off || !onPressDay}
                onPress={() => onPressDay?.(day)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? colors.accent : undefined,
                  borderWidth: day === today && !isSelected ? 1 : 0,
                  borderColor: colors.ink,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope_700Bold',
                    fontSize: 15,
                    color: isSelected ? '#fff' : off ? '#C5C6CC' : colors.ink,
                  }}
                >
                  {Number(day.slice(8))}
                </Text>
                {dots.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 2, position: 'absolute', bottom: 3 }}>
                    {dots.slice(0, 3).map((dot, i) => (
                      <View
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isSelected ? '#fff' : dot.color,
                        }}
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export interface TentativeDates {
  tentativeStartDate: string | null;
  tentativeEndDate: string | null;
  tentativeDates: string[];
}

/**
 * Tentative dates for a plan, like Airbnb: tap a start and an end day for a range,
 * or switch to "Días sueltos" to pick specific days.
 */
export function TentativeDatesPicker({
  value,
  onChange,
  error,
}: {
  value: TentativeDates;
  onChange: (value: TentativeDates) => void;
  error?: string;
}) {
  const today = todayInLima();
  const [mode, setMode] = useState<'range' | 'days'>(
    value.tentativeDates.length ? 'days' : 'range',
  );
  const [month, setMonth] = useState(
    (value.tentativeDates[0] ?? value.tentativeStartDate ?? today).slice(0, 7),
  );
  const start = value.tentativeStartDate,
    end = value.tentativeEndDate,
    days = value.tentativeDates;
  const empty = { tentativeStartDate: null, tentativeEndDate: null, tentativeDates: [] };

  const pressDay = (day: string) => {
    if (mode === 'days') {
      const next = days.includes(day)
        ? days.filter((item) => item !== day)
        : [...days, day].sort();
      onChange({ ...empty, tentativeDates: next });
      return;
    }
    // First tap: start. Second tap: end (or a new start if it is earlier). Third tap: start over.
    if (!start || (start && end) || day < start)
      onChange({ ...empty, tentativeStartDate: day });
    else onChange({ ...empty, tentativeStartDate: start, tentativeEndDate: day });
  };

  const summary =
    mode === 'days'
      ? days.length
        ? `${days.length} ${days.length === 1 ? 'día elegido' : 'días elegidos'}: ${days.map((day) => formatDate(day)).join(', ')}`
        : 'Toca los días que podrían funcionar.'
      : start && end
        ? `Del ${formatDate(start)} al ${formatDate(end)}`
        : start
          ? `Desde el ${formatDate(start)}. Toca otro día para cerrar el rango, o deja solo este día.`
          : 'Toca el primer día y luego el último.';

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>Fechas tentativas (opcional)</Text>
      <Tabs
        items={
          [
            ['range', 'Rango de fechas'],
            ['days', 'Días sueltos'],
          ] as const
        }
        value={mode}
        onChange={(next) => {
          setMode(next);
          onChange(empty);
        }}
      />
      <View
        style={{
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: 14,
          padding: 8,
        }}
      >
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          onPressDay={pressDay}
          disabled={(day) => day < today}
          selected={(day) =>
            mode === 'days' ? days.includes(day) : day === start || day === end
          }
          inRange={(day) =>
            mode === 'range' && Boolean(start && end && day > start! && day < end!)
          }
        />
      </View>
      <Text style={error ? styles.error : styles.muted} accessibilityLiveRegion="polite">
        {error ?? summary}
      </Text>
      {(start || days.length > 0) && (
        <Button variant="quiet" icon="x" onPress={() => onChange(empty)}>
          Quitar fechas
        </Button>
      )}
    </View>
  );
}

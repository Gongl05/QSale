import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { locationSchema, type Location, type OptionInput } from '@qsale/contracts';
import { DateField } from '../../../../src/DateField';
import { api } from '../../../../src/session';
import { LocationPicker } from '../../../../src/Map';
import { Button, Field, Heading, Screen, Tabs, Text, styles, useAction } from '../../../../src/ui';
export default function Proposal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [type, setType] = useState<'DATE' | 'PLACE'>('DATE'),
    [label, setLabel] = useState(''),
    [description, setDescription] = useState(''),
    [startDay, setStartDay] = useState(''),
    [startTime, setStartTime] = useState(''),
    [endDay, setEndDay] = useState(''),
    [endTime, setEndTime] = useState(''),
    [location, setLocation] = useState<Location | null>(null),
    [error, setError] = useState('');
  const action = useAction(
    (input: OptionInput) => api.createOption(Number(id), input),
    'Propuesta lista para recibir votos.',
    () => router.back(),
  );
  return (
    <Screen>
      <Heading
        title="Una nueva propuesta"
        description="Pongan opciones sobre la mesa y decidan juntos."
      />
      <View style={styles.surface}>
        <Tabs
          items={
            [
              ['DATE', 'Fecha'],
              ['PLACE', 'Lugar'],
            ] as const
          }
          value={type}
          onChange={setType}
        />
        <Field
          label="Título de la propuesta"
          value={label}
          onChangeText={setLabel}
          maxLength={120}
        />
        <Field
          label="Un detalle para el grupo (opcional)"
          value={description}
          onChangeText={setDescription}
          maxLength={500}
        />
        {type === 'DATE' ? (
          <>
            <DateField
              label="Día de inicio"
              value={startDay}
              onChange={setStartDay}
              optional={false}
            />
            <DateField
              label="Hora de inicio (Lima)"
              mode="time"
              value={startTime}
              onChange={setStartTime}
              optional={false}
            />
            <DateField label="Día final (opcional)" value={endDay} onChange={setEndDay} />
            <DateField
              label="Hora final (opcional)"
              mode="time"
              value={endTime}
              onChange={setEndTime}
            />
          </>
        ) : (
          <LocationPicker value={location} onChange={setLocation} />
        )}
        <Text style={styles.muted}>
          Puedes proponer más de una alternativa y votar por las que te funcionan.
        </Text>
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          busy={action.isPending}
          onPress={() => {
            setError('');
            if (label.trim().length < 3) {
              setError('Escribe un título de al menos 3 caracteres.');
              return;
            }
            const normalized = startDay + 'T' + startTime,
              finish = endDay || endTime ? endDay + 'T' + endTime : '';
            if (
              type === 'DATE' &&
              (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ||
                Number.isNaN(new Date(normalized + '-05:00').getTime()) ||
                new Date(normalized + '-05:00').getTime() <= Date.now())
            ) {
              setError('Escribe una fecha y hora futuras con el formato indicado.');
              return;
            }
            if (
              type === 'DATE' &&
              finish &&
              (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(finish) || finish < normalized)
            ) {
              setError('El final debe tener el mismo formato y ser posterior al inicio.');
              return;
            }
            if (type === 'PLACE' && !locationSchema.safeParse(location).success) {
              setError('Elige una ubicación válida.');
              return;
            }
            action.mutate({
              type,
              label: label.trim(),
              description,
              ...(type === 'DATE'
                ? { startsAt: normalized, ...(finish ? { endsAt: finish } : {}) }
                : { location: location! }),
            });
          }}
        >
          Publicar propuesta
        </Button>
      </View>
    </Screen>
  );
}

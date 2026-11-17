import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@qsale/api-client';
import {
  canContribute,
  dateInputError,
  dateOptionInput,
  locationSchema,
  type Location,
  type OptionInput,
} from '@qsale/contracts';
import { DateField } from '../../../../src/DateField';
import { api } from '../../../../src/session';
import { LocationPicker } from '../../../../src/Map';
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Loading,
  Screen,
  Tabs,
  Text,
  styles,
  useAction,
} from '../../../../src/ui';
export default function Proposal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const planId = Number(id);
  const valid = Number.isSafeInteger(planId) && planId > 0;
  const query = useQuery({
    queryKey: ['plan', planId],
    queryFn: ({ signal }) => api.plan(planId, signal),
    enabled: valid,
  });
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
    () => router.dismissTo(('/plans/' + planId) as '/plans/[id]'),
  );
  if (!valid)
    return (
      <Screen>
        <ErrorState error={new ApiError('El enlace del plan no es válido.', 404)} />
      </Screen>
    );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Screen>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </Screen>
    );
  if (!canContribute(query.data))
    return (
      <Screen>
        <ErrorState
          error={
            new ApiError(
              query.data.status !== 'OPEN'
                ? 'El plan ya está cerrado o cancelado. Puedes consultar sus propuestas.'
                : 'Primero acepta la invitación para proponer.',
              403,
            )
          }
        />
        <Button onPress={() => router.dismissTo(('/plans/' + planId) as '/plans/[id]')}>
          Ver plan
        </Button>
      </Screen>
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
              label="Hora de inicio (Lima, opcional)"
              mode="time"
              value={startTime}
              onChange={setStartTime}
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
            const dateError = dateInputError(startDay, startTime, endDay, endTime);
            if (type === 'DATE' && dateError) {
              setError(dateError);
              return;
            }
            if (type === 'PLACE' && !locationSchema.safeParse(location).success) {
              setError('Busca la dirección del lugar o márcalo en el mapa.');
              return;
            }
            action.mutate({
              type,
              label: label.trim(),
              description,
              ...(type === 'DATE'
                ? dateOptionInput(startDay, startTime, endDay, endTime)
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

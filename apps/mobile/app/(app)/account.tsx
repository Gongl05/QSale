import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  genderLabels,
  profileSchema,
  type Gender,
  type ProfileForm,
} from '@qsale/contracts';
import { api, useSession } from '../../src/session';
import { Avatar, pickAvatar } from '../../src/Avatar';
import { DateField } from '../../src/DateField';
import { Button, Field, Screen, Tabs, Text, styles, useToast } from '../../src/ui';

const genders = Object.entries(genderLabels) as [Gender, string][];
const withYear = (day: string) =>
  new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day + 'T12:00:00Z'));

export default function Account() {
  const { user, updateUser } = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const toast = useToast();
  const [photoBusy, setPhotoBusy] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    mode: 'onChange',
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user!.name,
      surname: user!.surname ?? '',
      nickname: user!.nickname ?? '',
      phone: user!.phone ?? '',
      birthDate: user!.birthDate ?? null,
      gender: user!.gender ?? null,
    },
  });
  const fullName = [user!.name, user!.surname].filter(Boolean).join(' ');

  const changePhoto = async (source: 'library' | 'camera') => {
    setPhotoBusy(true);
    try {
      const picture = await pickAvatar(source);
      if (!picture) return;
      updateUser(await api.updateAvatar(picture));
      await cache.invalidateQueries({ queryKey: ['participants'] });
      toast('Tu foto está actualizada.');
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Avatar userId={user!.id} version={user!.avatarVersion} name={fullName} size={110} />
        <View style={styles.row}>
          <Button
            variant="secondary"
            icon="image"
            busy={photoBusy}
            onPress={() =>
              Alert.alert('Foto de perfil', undefined, [
                { text: 'Elegir de la galería', onPress: () => void changePhoto('library') },
                { text: 'Tomar una foto', onPress: () => void changePhoto('camera') },
                ...(user!.avatarVersion
                  ? [
                      {
                        text: 'Quitar foto',
                        style: 'destructive' as const,
                        onPress: () =>
                          void api
                            .deleteAvatar()
                            .then(updateUser)
                            .catch((error) => toast(error.message, true)),
                      },
                    ]
                  : []),
                { text: 'Volver', style: 'cancel' as const },
              ])
            }
          >
            {user!.avatarVersion ? 'Cambiar foto' : 'Agregar foto'}
          </Button>
        </View>
      </View>
      <View style={styles.surface}>
        <Controller
          control={control}
          name="nickname"
          render={({ field, fieldState }) => (
            <Field
              label="¿Cómo te llaman tus amigos?"
              placeholder="Lau, Pipe, Cami, Mari"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={30}
              error={fieldState.error?.message}
              hint="Así te verán en los planes. Si lo dejas vacío, usaremos tu nombre."
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field
              label="Nombre*"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={100}
              autoComplete="given-name"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="surname"
          render={({ field, fieldState }) => (
            <Field
              label="Apellido"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={100}
              autoComplete="family-name"
              error={fieldState.error?.message}
            />
          )}
        />
        <Field
          label="Correo electrónico"
          value={user!.email}
          editable={false}
          style={{ color: '#8A8D99', backgroundColor: '#F2F1ED' }}
          hint="Tu correo no se puede cambiar. Para usar otro, tendrías que crear otra cuenta."
        />
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <Field
              label="Teléfono móvil"
              placeholder="+51 987 654 321"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={20}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field, fieldState }) => (
            <DateField
              label="Fecha de nacimiento"
              value={field.value ?? ''}
              onChange={(value) => field.onChange(value || null)}
              maximumDate={new Date()}
              formatValue={withYear}
              error={fieldState.error?.message}
            />
          )}
        />
        <Text style={styles.label}>Género</Text>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Tabs items={genders} value={field.value ?? ('' as Gender)} onChange={field.onChange} />
          )}
        />
        {errors.root && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.root.message}
          </Text>
        )}
        <Button
          busy={isSubmitting}
          onPress={handleSubmit(async (values) => {
            try {
              updateUser(
                await api.updateProfile({
                  name: values.name,
                  surname: values.surname || null,
                  nickname: values.nickname || null,
                  phone: values.phone || null,
                  birthDate: values.birthDate,
                  gender: values.gender,
                }),
              );
              await cache.invalidateQueries();
              toast('Tu perfil está actualizado.');
              router.back();
            } catch (error) {
              setError('root', { message: (error as Error).message });
            }
          })}
        >
          Guardar
        </Button>
      </View>
    </Screen>
  );
}

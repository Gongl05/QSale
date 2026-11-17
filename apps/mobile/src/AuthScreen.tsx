import { useState } from 'react';
import { Image, View, Pressable } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Feather from '@expo/vector-icons/Feather';
import { safeReturnPath, signInSchema, signUpSchema, type SignUpInput } from '@qsale/contracts';
import { useSession } from './session';
import { Button, Field, Heading, Loading, Screen, Text, colors, styles } from './ui';

export default function AuthScreen({ registering = false }: { registering?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnPath(params.returnTo, '/');
  const { user, loading, signIn, signUp } = useSession();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpInput>({
    mode: 'onTouched',
    resolver: zodResolver(registering ? signUpSchema : signInSchema) as never,
    defaultValues: { name: '', email: '', password: '' },
  });
  if (loading) return <Loading />;
  if (user) return <Redirect href={returnTo as '/'} />;
  return (
    <Screen safeTop>
      <View
        style={{
          backgroundColor: colors.cream,
          marginHorizontal: -22,
          marginTop: -22,
          padding: 28,
          gap: 20,
        }}
      >
        <View style={styles.row}>
          <Image source={require('../assets/qsale.png')} style={{ width: 45, height: 45 }} />
          {/* lineHeight must grow with the font size; the inherited 25 clipped the top of the letters. */}
          <Text style={{ fontSize: 30, lineHeight: 38, fontFamily: 'Manrope_800ExtraBold' }}>
            QSale.
          </Text>
        </View>
        <Text style={[styles.title, { fontSize: 33, lineHeight: 40 }]}>
          Ese “hay que hacer algo” sí va a salir.
        </Text>
      </View>
      <View style={{ paddingTop: 14, gap: 20 }}>
        <Heading
          title={registering ? 'Reúne a tu gente' : 'Qué bueno verte por aquí'}
          description={
            registering
              ? 'Crea tu cuenta y hagan que ese plan salga.'
              : 'Entra y descubre qué está tomando forma.'
          }
        />
        {registering && (
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <Field
                label="Tu nombre"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoComplete="name"
                error={error?.message}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
            <Field
              label="Correo electrónico"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={error?.message}
            />
          )}
        />
        <View>
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
              <Field
                label="Contraseña"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!visible}
                autoComplete={registering ? 'new-password' : 'current-password'}
                error={error?.message}
                hint={
                  registering
                    ? 'Al menos 8 caracteres, una mayúscula, una minúscula y un número.'
                    : undefined
                }
                style={{ paddingRight: 46 }}
              />
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={() => setVisible(!visible)}
            style={{ position: 'absolute', right: 5, top: 27, padding: 12 }}
          >
            <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
          </Pressable>
        </View>
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          busy={isSubmitting}
          onPress={handleSubmit(async (values) => {
            setError('');
            try {
              await (registering ? signUp(values) : signIn(values));
              router.replace(returnTo as '/');
            } catch (error) {
              setError((error as Error).message);
            }
          })}
        >
          {registering ? 'Crear mi cuenta' : 'Entrar a QSale'}
        </Button>
        <Button
          variant="quiet"
          onPress={() =>
            router.replace({ pathname: registering ? '/login' : '/register', params: { returnTo } })
          }
        >
          {registering ? 'Ya tengo cuenta' : 'Quiero crear mi cuenta'}
        </Button>
      </View>
    </Screen>
  );
}

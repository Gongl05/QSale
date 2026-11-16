import { useState } from "react";
import { Image, View, Pressable } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Feather from "@expo/vector-icons/Feather";
import {
  safeReturnPath,
  signInSchema,
  signUpSchema,
  type SignUpInput,
} from "@qsale/contracts";
import { useSession } from "./session";
import { Button, Field, Heading, Loading, Screen, Text, useUI } from "./ui";

export default function AuthScreen({
  registering = false,
}: {
  registering?: boolean;
}) {
  const { colors, styles, dark } = useUI();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnPath(params.returnTo, "/");
  const { user, loading, signIn, signUp } = useSession();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpInput>({
    mode: "onTouched",
    resolver: zodResolver(registering ? signUpSchema : signInSchema) as never,
    defaultValues: { name: "", email: "", password: "" },
  });
  if (loading) return <Loading />;
  if (user) return <Redirect href={returnTo as "/"} />;
  return (
    <Screen safeTop>
      <View
        style={{
          gap: 32,
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
          paddingTop: 24,
        }}
      >
        <View style={styles.row}>
          <Image
            source={require("../assets/qsale.png")}
            accessibilityLabel="QSale"
            style={{ width: 48, height: 48 }}
          />
          <Text style={[styles.heading, { fontSize: 26 }]}>QSale</Text>
        </View>
        <Heading
          title={registering ? "Crear cuenta" : "Iniciar sesión"}
          description={
            registering
              ? "Elijan una fecha, acuerden un lugar y confirmen quién va."
              : "Vuelve a los planes de tu grupo."
          }
        />
        {registering && (
          <Controller
            control={control}
            name="name"
            render={({
              field: { value, onChange, onBlur },
              fieldState: { error },
            }) => (
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
          render={({
            field: { value, onChange, onBlur },
            fieldState: { error },
          }) => (
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
            render={({
              field: { value, onChange, onBlur },
              fieldState: { error },
            }) => (
              <Field
                label="Contraseña"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!visible}
                autoComplete={registering ? "new-password" : "current-password"}
                error={error?.message}
                hint={
                  registering
                    ? "Al menos 8 caracteres, una mayúscula, una minúscula y un número."
                    : undefined
                }
                style={{ paddingRight: 46 }}
              />
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            onPress={() => setVisible(!visible)}
            style={{
              position: "absolute",
              right: 0,
              top: 29,
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name={visible ? "eye-off" : "eye"}
              size={20}
              color={colors.muted}
            />
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
            setError("");
            try {
              await (registering ? signUp(values) : signIn(values));
              router.replace(returnTo as "/");
            } catch (error) {
              setError((error as Error).message);
            }
          })}
        >
          {registering ? "Crear mi cuenta" : "Entrar a QSale"}
        </Button>
        {!registering && (
          <Button
            variant="quiet"
            onPress={() => router.push("/forgot-password")}
          >
            Olvidé mi contraseña
          </Button>
        )}
        <Button
          variant="quiet"
          onPress={() =>
            router.replace({
              pathname: registering ? "/login" : "/register",
              params: { returnTo },
            })
          }
        >
          {registering ? "Ya tengo cuenta" : "Quiero crear mi cuenta"}
        </Button>
      </View>
    </Screen>
  );
}

# QSale — Coordinación inteligente de planes grupales

**Curso:** CS 2031 Desarrollo Basado en Plataforma — 2026-2

**Integrantes:** Gonzalo Gaviño · Mathias Pariona · Adriano Raffo

**Despliegue:** AWS EC2 + Dokploy + RDS PostgreSQL · **Postman:** [`postman_collection.json`](postman_collection.json)

**URL verificada el 14 de noviembre de 2026:** [Health](https://api.98.81.93.181.sslip.io/actuator/health) · [Swagger UI](https://api.98.81.93.181.sslip.io/swagger-ui.html). Los recursos se detienen entre sesiones para conservar el crédito del laboratorio. Al iniciar EC2, comprueba su IP pública y actualiza el dominio si cambió.

---

## Índice

1. [Introducción](#1-introducción)
2. [Identificación del problema](#2-identificación-del-problema)
3. [Descripción de la solución](#3-descripción-de-la-solución)
4. [Modelo de entidades](#4-modelo-de-entidades)
5. [Manejo de errores](#5-manejo-de-errores)
6. [Medidas de seguridad](#6-medidas-de-seguridad)
7. [Eventos y asincronía](#7-eventos-y-asincronía)
8. [GitHub & Management](#8-github--management)
9. [Ejecución local y despliegue](#9-ejecución-local-y-despliegue)
10. [Conclusión](#10-conclusión)
11. [Apéndices](#11-apéndices)

---

## 1. Introducción

**Contexto.** Organizar una salida en grupo (una cena, un viaje, un cumpleaños) casi siempre ocurre en chats de WhatsApp mezclados con enlaces de mapas. Quién va, qué día le sirve a cada uno, dónde reunirse y cuánto gastar quedan dispersos entre mensajes y respuestas ambiguas como "creo que sí".

**Objetivos.**
- Centralizar en una API REST la creación de planes, las invitaciones y las respuestas de los participantes.
- Registrar disponibilidad, proponer y votar fechas y lugares.
- Comparar lugares según la distancia real del grupo usando un servicio de mapas.
- Medir la viabilidad del plan con un semáforo y avisar automáticamente cuando puede cerrarse.

## 2. Identificación del problema

**Descripción.** El organizador de un plan grupal no tiene una fuente única de verdad: insiste para obtener respuestas y decide sin saber qué opción le conviene a la mayoría ni quién está realmente comprometido.

**Justificación.** Es un problema cotidiano de cualquier grupo. Reducir la fricción de coordinar evita planes que nunca se concretan, y hacer explícitos el compromiso y la cercanía permite decisiones más justas.

## 3. Descripción de la solución

### Funcionalidades implementadas

| Funcionalidad | Cómo resuelve el problema |
|---|---|
| Registro y login con JWT | Cada participante tiene identidad propia |
| Planes con código de invitación | Tipo, presupuesto, mínimo de participantes y fechas tentativas, compartidos con un código |
| Invitaciones por email | El invitado recibe notificación y correo |
| Alternativas y votos | Fechas o lugares propuestos por el grupo, ordenados por puntaje |
| Disponibilidad | Días y horarios en que cada uno puede asistir |
| Nivel de compromiso | Confirmado, Me interesa o No puedo, en vez de respuestas ambiguas |
| Comparación geográfica | Distancia y tiempo promedio del grupo a cada lugar |
| Semáforo de viabilidad | Índice 0–100: `NOT_VIABLE`, `TO_BE_DEFINED` o `READY_TO_CLOSE` |
| Cierre del plan | Solo con semáforo en verde; fija la fecha y el lugar más votados |
| Notificaciones y correos | Invitación, cambios, mínimo alcanzado, cierre o cancelación |

### Tecnologías utilizadas

- **Lenguaje y framework:** Java 21, Spring Boot 4.1 (Web MVC, Data JPA / Hibernate 7, Security, Validation, Mail, Thymeleaf, Actuator).
- **Base de datos:** PostgreSQL 16 (Docker en local).
- **Seguridad:** JWT con jjwt 0.12, BCrypt.
- **Mapeo:** ModelMapper.
- **API externa:** [OpenRouteService Matrix API](https://openrouteservice.org/) para distancias y tiempos de traslado, con respaldo por fórmula de Haversine.
- **Correo:** JavaMailSender + plantillas Thymeleaf; Mailpit como servidor SMTP de desarrollo.
- **Documentación:** Springdoc OpenAPI (Swagger UI) y colección de Postman.
- **Testing y CI:** JUnit 5, Mockito, Testcontainers, GitHub Actions.
- **Otros:** Lombok, Docker.
- **Web:** React, TypeScript, React Router, Axios, TanStack Query, React Hook Form y Zod; servidor Node para la sesión mediante cookie HttpOnly.
- **Móvil:** React Native y Expo Router, SecureStore para los tokens, cámara para invitaciones QR y ubicación GPS bajo solicitud.
- **Mapa en los clientes:** Leaflet y OpenStreetMap, con atribución y alternativa manual por coordenadas.

### Arquitectura

```mermaid
flowchart LR
    Web[React web] -->|Cookie HttpOnly| Session[Node / sesión web]
    Session -->|JWT| Filter[JwtAuthorizationFilter]
    Mobile[React Native / Expo] -->|JWT / SecureStore| Filter
    Client[Postman] -->|JWT| Filter
    Filter --> Controller[Controllers<br/>application]
    Controller --> Service[Services<br/>domain]
    Service --> Repository[Repositories<br/>infrastructure]
    Repository --> DB[(PostgreSQL)]
    Service -. publica .-> Events[ApplicationEvents]
    Events -. "@Async" .-> Listeners[Listeners]
    Listeners --> Mail[Resend / SMTP]
    Listeners --> ORS[OpenRouteService]
```

Los controladores reciben y validan solicitudes HTTP; los servicios concentran reglas y permisos; los repositorios encapsulan persistencia. Se usan DTO separados para entrada y salida, de modo que contraseñas y relaciones JPA internas no se publican. Flyway aplica las migraciones versionadas y Hibernate valida la correspondencia con las entidades. `@Version` en planes y opciones permite detectar modificaciones concurrentes.

## 4. Modelo de entidades

```mermaid
erDiagram
    USER ||--o{ PLAN : crea
    USER ||--o{ PLAN_PARTICIPANT : participa
    PLAN ||--o{ PLAN_PARTICIPANT : tiene
    PLAN ||--o{ PLAN_OPTION : ofrece
    PLAN_OPTION ||--o{ VOTE : recibe
    USER ||--o{ VOTE : emite
    PLAN ||--o{ AVAILABILITY : registra
    USER ||--o{ AVAILABILITY : declara
    PLAN ||--o{ COMMITMENT_RESPONSE : registra
    USER ||--o{ COMMITMENT_RESPONSE : responde
    USER ||--o{ NOTIFICATION : recibe
    USER ||--o| LOCATION : tiene
    PLAN_OPTION ||--o| LOCATION : refiere
```

`User` guarda identidad, rol y ubicación opcional. `Plan` mantiene el presupuesto, mínimo de asistentes, fechas, código de invitación, estado y semáforo. `PlanParticipant` relaciona usuarios con planes y diferencia organizador, invitado y miembro unido. `PlanOption` contiene fechas o lugares propuestos; un lugar se asocia a `Location`, que guarda dirección y coordenadas. `Vote`, `Availability` y `CommitmentResponse` registran las decisiones individuales. `Notification` persiste avisos, fecha de lectura y estado de envío. La base incluye unicidad de email, código de invitación, voto por usuario/opción y compromiso por usuario/plan; las claves foráneas e índices sostienen integridad y consultas frecuentes. Los DTO y Bean Validation restringen rangos, longitud y formato antes de guardar.

## 5. Manejo de errores

`GlobalExceptionHandler` transforma las excepciones del dominio en respuestas HTTP consistentes con marca temporal, estado, tipo, mensaje y ruta. Se distinguen entradas inválidas (`400`), autenticación ausente (`401`), acceso denegado (`403`), recurso inexistente (`404`) y conflictos (`409`). También se manejan validaciones de `@Valid`, JSON mal formado y errores inesperados (`500`). El filtro de seguridad usa su propio manejador para responder antes de entrar al controlador. Por ejemplo, un participante ajeno al plan recibe `403` incluso si conoce su identificador, y un voto repetido no se guarda dos veces. Un fallo de OpenRouteService no elimina el plan: activa el cálculo aproximado.

## 6. Medidas de seguridad

Spring Security usa sesiones `STATELESS`, JWT en `Authorization: Bearer` y BCrypt para las contraseñas. El login emite tokens de acceso y refresh; el filtro verifica firma, vencimiento y tipo, y carga al usuario desde la base. La clave `JWT_SECRET` se obtiene del entorno. Registro, login, Swagger y salud son públicos; el resto requiere autenticación. Los endpoints `/api/v1/admin/**` exigen rol `ADMIN`. `PlanAccessService` aplica membresía y rol de organizador dentro de los servicios, no solo en la URL. CORS permite únicamente los orígenes configurados en `CORS_ALLOWED_ORIGINS` y CSRF está desactivado para esta API sin cookies de sesión.

Las consultas JPA parametrizadas evitan concatenar SQL de entrada del cliente, los DTO no exponen hashes de contraseña y las validaciones rechazan datos inconsistentes. Ninguna credencial de producción debe quedar en Git, capturas, Postman ni logs. Si una contraseña o clave se comparte por error, hay que revocarla o rotarla en el proveedor y actualizar el servicio; cambiar un archivo local no invalida la credencial anterior.

## 7. Eventos y asincronía

El registro, las invitaciones, los cambios de plan, los votos y las respuestas publican eventos. Los listeners recalculan la viabilidad, crean notificaciones y preparan correos; `@EnableAsync` y un `ThreadPoolTaskExecutor` desacoplan las operaciones externas del tiempo de respuesta HTTP. Hay plantillas Thymeleaf para bienvenida, invitación, plan listo y cierre. Las notificaciones se pueden listar y marcar como leídas, y un fallo del proveedor de correo queda registrado como estado `FAILED` cuando se intenta enviar el aviso.

En desarrollo, JavaMailSender usa Mailpit en `localhost:1025`, con bandeja en `http://localhost:8025`. En AWS, el correo usa la API HTTPS de Resend con `RESEND_API_KEY` y `MAIL_FROM`. El remitente `onboarding@resend.dev` solo permite destinatarios autorizados por Resend; las invitaciones a otros usuarios requieren un dominio verificado. Comprueba la recepción real, además de la respuesta del proveedor.

## 8. GitHub & Management

El equipo integra cambios mediante pull requests hacia `main`. `.github/workflows/ci.yml` ejecuta `mvn -B clean verify` con Java 21; no despliega. Revisiones y tareas se registran en GitHub Issues/Projects. El CI del PR #10 quedó bloqueado por facturación de GitHub; el PR documenta la validación local. Los secretos se configuran en Dokploy.

## 9. Ejecución local y despliegue

Se necesitan Java 21, Maven y Docker. Desde la raíz del repositorio, ejecutar `docker compose up -d`, configurar un `JWT_SECRET` aleatorio de al menos 32 caracteres y lanzar `./mvnw spring-boot:run` (en Windows, `.\mvnw.cmd spring-boot:run`). PostgreSQL queda en el puerto 5433, Mailpit en 8025 y la API en 8080. La primera ejecución aplica Flyway; no usar `ddl-auto=create` en bases compartidas. Comprobar `GET /actuator/health` y abrir `/swagger-ui.html`.

Las variables de entorno principales son:

| Variable | Obligatoria | Uso |
|---|---:|---|
| `JWT_SECRET` | Sí | Firma de tokens JWT; usar una cadena aleatoria de al menos 32 caracteres. |
| `SPRING_DATASOURCE_URL` | AWS | URL JDBC de RDS con `sslmode=require`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Local | Host, puerto y base; por defecto `localhost:5433/qsale`. |
| `DB_USER`, `DB_PASSWORD` | AWS | Credenciales de RDS; local usa `postgres` por defecto. |
| `DATABASE_URL` | Opcional | Alternativa PostgreSQL compatible; déjala ausente en AWS para no reemplazar la conexión a RDS. |
| `MAPS_API_KEY` | Opcional | Clave de OpenRouteService para rutas y tiempos reales; sin ella se usa Haversine. |
| `RESEND_API_KEY` | Opcional | Clave de Resend para enviar correo por HTTPS. |
| `MAIL_FROM` | Recomendada | Remitente verificado, por ejemplo `QSale <onboarding@resend.dev>`. |
| `CORS_ALLOWED_ORIGINS` | Opcional | Orígenes permitidos por CORS, separados por comas. |

### Clientes web y móvil

Los clientes están en `apps/web` y `apps/mobile`. Comparten los contratos, validaciones y el cliente Axios de `packages/contracts` y `packages/api-client`. La información de planes, votos, disponibilidad, asistencia y notificaciones procede de la API. El listado de planes y las notificaciones usan endpoints paginados diferentes; el tamaño admite 10, 25, 50 y 100 elementos.

Necesitas Node.js 24 y una API local en ejecución. Instala las dependencias desde la raíz:

```sh
npm ci
npm run dev:web
```

La web abre en `http://127.0.0.1:5173`; su servidor de sesión escucha en `3001`. El valor de desarrollo de `API_URL` es `http://127.0.0.1:19080/api/v1`. Si ejecutas Spring Boot en su puerto habitual `8080`, configura `API_URL=http://127.0.0.1:8080/api/v1` al iniciar el proceso o en `apps/web/.env.local`. Este archivo queda excluido de Git y Docker. `APP_ORIGIN` debe coincidir exactamente con el origen del navegador; su valor local es `http://127.0.0.1:5173`.

El navegador conserva el token de acceso en memoria y el de renovación en una cookie HttpOnly. En producción la cookie también usa Secure y SameSite=Lax. El servidor de sesión comprueba el origen de las operaciones de escritura, y el proxy no permite acceder directamente a los endpoints de autenticación. Ambos clientes comparten renovación de sesión, cancelación de consultas y reintentos limitados a lecturas ante fallos temporales. No se reintentan escrituras automáticamente.

Para abrir la app móvil, configura `EXPO_PUBLIC_API_URL` con la URL de la API accesible desde el teléfono y ejecuta:

```sh
npm run dev:mobile
```

En una prueba por Wi-Fi, el teléfono y la computadora deben estar en la misma red. Usa la IPv4 privada de la computadora; `localhost` en el teléfono apunta al propio teléfono. Expo Go y la CLI deben tener sesión iniciada en la misma cuenta de Expo. Abre el QR de desarrollo con la cámara del iPhone o desde Expo Go. La app solicita permisos de cámara y ubicación cuando seleccionas esas acciones; puedes escribir el código o las coordenadas si no concedes el permiso. Los tokens se guardan con SecureStore en iOS y Android; la vista previa de navegador usa memoria.

`EXPO_PUBLIC_WEB_URL` define el origen web admitido para los enlaces de invitación. Los QR también admiten el esquema `qsale://join/CODIGO`. Sin una URL web configurada, ese esquema sirve al lector interno de QSale; abrirlo desde otras apps requiere tener instalado el cliente nativo. Las variables `EXPO_PUBLIC_*` se incluyen en el cliente: configura únicamente URLs públicas, nunca contraseñas ni claves de mapas o correo.

Los horarios de las propuestas se coordinan en `America/Lima`. `PLANS_TIME_ZONE` configura el reloj de las validaciones del backend para evitar que un servidor UTC rechace una hora futura de Lima. Las estimaciones muestran si provienen de rutas o de Haversine; no se presentan como tráfico real ni como rutas individuales de los participantes.

Comprueba el código con:

```sh
npm run check
npm test
npm run build:web
npm run test:web
```

La prueba de navegador usa una API aislada en `127.0.0.1:19080`, PostgreSQL y Mailpit; crea cuentas y planes de prueba y elimina sus planes al terminar. No la ejecutes contra una base compartida o de producción. Para comprobar los paquetes nativos, ejecuta desde `apps/mobile`:

```sh
npx expo-doctor
npx expo export --platform android --platform ios --output-dir dist
```

Exportar comprueba la generación de los paquetes; la cámara, el GPS, los permisos, la persistencia y la navegación también deben probarse en el dispositivo. `apps/mobile/eas.json` prepara perfiles de desarrollo y distribución interna; esos perfiles no implican que exista un build publicado.

### Desplegar la web en el servidor existente

Usa el repositorio como contexto raíz y `apps/web/Dockerfile` como Dockerfile. El contenedor sirve la web y el intermediario de sesión en el puerto `3001`. Configura `NODE_ENV=production`, `APP_ORIGIN` con el origen HTTPS público de la web y `API_URL` con la raíz real de la API, incluida la terminación `/api/v1`. Dokploy debe publicar el puerto `3001` mediante HTTPS. No hace falta crear otra instancia EC2, otra base de datos ni una IP elástica para este servicio.

Comprueba `/health`, acceso y recarga de sesión, rutas directas como `/plans/ID`, invitaciones entre dos usuarios y ambas paginaciones desde la URL pública. El despliegue de la API debe incluir las migraciones V1 y V2 antes de usar los clientes. Configura la app móvil con la URL HTTPS vigente y comprueba ambos clientes contra la misma API. La verificación local no sustituye esas comprobaciones públicas ni la disponibilidad durante la evaluación.

### AWS con Dokploy

El despliegue configurado en `us-east-1` usa `qsale-backend` (EC2 Ubuntu 24.04, `t3.medium`, 30 GiB gp3) y `qsale-db` (RDS PostgreSQL 16, `db.t3.micro`, Single-AZ, 20 GiB gp2, acceso privado). Dokploy construye el `Dockerfile` de `main` y publica el puerto interno `8080` mediante HTTPS. RDS permite conexiones desde el grupo de seguridad de EC2.

En **QSale → production → backend → Environment**, configura las variables de producción:

```dotenv
PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://RDS_ENDPOINT:5432/qsale?sslmode=require
DB_USER=postgres
DB_PASSWORD=RDS_PASSWORD
JWT_SECRET=RANDOM_SECRET
DDL_AUTO=validate
SHOW_SQL=false
ADMIN_BOOTSTRAP_ENABLED=false
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=0
JAVA_TOOL_OPTIONS="-Xms128m -Xmx512m -XX:ActiveProcessorCount=2"
```

Sustituye `RDS_ENDPOINT` y `RDS_PASSWORD` por los datos de RDS, y `RANDOM_SECRET` por una clave privada aleatoria de al menos 32 caracteres. Conserva las claves de mapas y correo en ese panel; no las copies a Postman ni a Git. Sin `MAPS_API_KEY`, el cálculo usa Haversine a 25 km/h, sin tráfico real.

Para retomar el despliegue existente:

1. Revisa el saldo de AWS Academy e inicia RDS y EC2 cuando necesites probar en AWS.
2. Espera RDS **Disponible** y EC2 **En ejecución**; comprueba la IP pública de EC2.
3. Si cambió la IP, actualiza el host `api.IP_PUBLICA.sslip.io` en **Domains**, con HTTPS y puerto `8080`.
4. Comprueba `/actuator/health` (`UP`), Swagger y `/api/v1/users/me` sin token (`401`). Si cambió el código o el entorno, despliega `main` desde Dokploy y repite las comprobaciones.
5. Configura `hostUrl` de Postman con la URL HTTPS vigente y prueba registro, login y el flujo de un plan.

### Crédito y desconexión de Render

Desarrolla el frontend contra `http://localhost:8080`. Al finalizar pruebas remotas, detén RDS y EC2, verifica ambos estados y termina el laboratorio. El almacenamiento sigue cobrando; [RDS se reinicia automáticamente tras siete días detenida](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html). Revisa la fecha de reinicio en cada sesión. El crédito de US$50 no garantiza disponibilidad continua.

Render es el despliegue anterior. Retirar `render.yaml` no desconecta sus servicios: desactiva **Settings → Auto-Deploy → Off** en Render y retira el acceso de su GitHub App a **QSale**. Conserva los datos antiguos hasta comprobar si necesitas recuperarlos. Consulta [despliegues de Render](https://render.com/docs/deploys) y [acceso a repositorios](https://render.com/docs/git-provider).

## 10. Conclusión

**Logros.** QSale centraliza decisiones antes dispersas y permite cerrar un plan solo con compromiso y viabilidad suficientes. La solución combina reglas de negocio, transacciones, permisos por plan, eventos y servicios externos sin convertir cada fallo de correo o mapas en una caída del flujo principal.

**Aprendizajes clave.** Separar responsabilidades, proteger recursos por membresía y coordinar eventos requiere validar también las integraciones externas.

**Trabajo futuro.** Antes de conectar el frontend a AWS, configura `CORS_ALLOWED_ORIGINS` con su origen HTTPS y comprueba el flujo completo con dos usuarios. Quedan como mejoras observabilidad, reintentos y respaldos duraderos.

## 11. Apéndices

- [Colección Postman](postman_collection.json): solicitudes, ejemplos y variables de prueba.
- [Migraciones](src/main/resources/db/migration): esquema inicial y metadatos de estimación.
- [CI](.github/workflows/ci.yml): validación automática con Maven y Testcontainers.
- [Dockerfile](Dockerfile): imagen del backend desplegada con Dokploy en EC2.
- **Licencia:** MIT, especificada en [LICENSE](LICENSE).
- **Referencias:** [Spring Boot](https://spring.io/projects/spring-boot), [OpenRouteService](https://openrouteservice.org/), [Resend API](https://resend.com/docs/api-reference/emails/send-email) y [Dokploy](https://docs.dokploy.com/docs/core/domains).

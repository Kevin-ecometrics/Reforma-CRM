# Migration — Reforma Dental CRM

> Estado: **borrador** — este documento describe la migración; **todavía no se aplica nada**.

## 1. Objetivo

Migrar el CRM de Reforma Dental de una app Next.js 14 full-stack (API routes + lowdb + node-cron, pensada para localhost) a un modelo de dos piezas, **todo alojado en cPanel**:

- **Frontend (UI estática)**: webapp **integrado dentro del dashboard estático** `e-commetrics-dashboard` (Next.js 16, `output: 'export'` → carpeta `out/`), subido a cPanel. Acceso restringido por permisos de usuario.
- **Backend**: módulo Express **montado sobre el backend de producción ya existente de Reforma Dental** (`https://reformadental.com`, Express + Passenger), expuesto bajo el prefijo **`/crm/*`**, con **su propia base de datos MySQL** (`reforma_dental_crm`).

El dashboard recupera la URL del backend del CRM (igual que hace con Reforma, Palmas o Monge: cada webapp declara su `API_BASE_URL`).

> **Cambio de arquitectura (2026-09-25)**: el backend ya **no** es una Node.js App / subdominio aparte. Se integra en el Express de producción de `reformadental.com`, que ya tiene Express + Passenger + TLS válido (`ssl_verify=0`, cert DV de `clinicareforma.com` / `dentalreforma.com` / `reformadental.com`) y CORS con `access-control-allow-credentials: true`. Esto elimina de un plumazo el problema de SSL y replica el patrón ya usado en la organización: backend en el dominio raíz de cada marca (`reformadental.com`, `palmasrecovery.com`, `mongeortopedia.com`, `scaneat.mx`). El subdominio `api.reformadental.com` se creó durante la exploración pero **queda sin uso** y puede borrarse.

> **Matiz importante**: el CRM no es 100 % estático. Solo la UI es estática; todo el trabajo real (MySQL, sync de Facebook, `node-cron`, SMTP/Twilio/WhatsApp) vive en el proceso Node del backend. El frontend sin ese backend sería una tabla vacía.

## 2. Arquitectura destino (Opción A — CRM dentro del dashboard)

```
cPanel — hosting estático (public_html)      reformadental.com — Apache + Passenger
┌────────────────────────────────────┐         ┌───────────────────────────────────────┐
│  out/ del dashboard (build)        │  axios  │  Express de Reforma (YA EXISTE)        │
│  └── /dashboard/webapp/            │ ──────▶ │  ├─ /api/*        calendario (actual)│
│      reforma-crm/                  │  CRM_   │  ├─ /fechas-*     calendario (actual)│
│  · pipeline board + tasks          │  API_   │  └─ /crm/*        ◀── ESTE PROYECTO │
│  · detalle lead (query param)      │  URL    │       /crm/leads    /crm/leads/:id  │
│  · settings / integraciones        │         │       /crm/tasks    /crm/sync       │
│  · login propio del CRM            │         │       /crm/dashboard /crm/settings   │
└────────────────────────────────────┘         │       /crm/templates /crm/rules/:id  │
                                               │       /crm/whatsapp/webhook  ◀── Meta│
                                               │       /crm/whatsapp/onboard/callback│
                                               │       JWT propio (users_crm)         │
                                               └──────────────────┬────────────────────┘
                                                  MySQL — reforma_dental_crm (base propia)
                                                  · leads, tasks, activities, stages,
                                                    rules, templates, sync_state, users_crm
```

Principios:
- El dashboard (estático) **nunca toca los datos**; el webapp llama directo a la API del CRM por URL (`CRM_API_URL`).
- El CRM vive **namespacado bajo `/crm/*`** y **no toca** ninguna ruta existente del calendario (`/api/appointments`, `/fechas-bloqueadas`, `/bloquear-fecha`, `/desbloquear-fecha`, `/api/appointments-dashboard`). El backend actual mezcla rutas con y sin prefijo `/api`; `/crm` es un espacio de nombres nuevo y no colisiona.
- **La seguridad real la da el CRM**, no el sidebar del dashboard. **La autenticación es un requisito previo, no una fase posterior**: hoy el CRM no tiene ninguna (`grep auth|jwt|bcrypt|session` → 0 resultados; el README lo declara: *"No login/auth — single local user, meant to run on localhost only"*). Montado en un Express público, `GET /crm/leads` expone PII de clientes y `POST /crm/leads/:id/send` / `/crm/messaging-test` permiten gastar presupuesto de Twilio/Meta a un visitante anónimo. Auth antes de exponer la primera ruta.
- Secrets (SMTP, Twilio, WhatsApp, FB) viven en el `.env` del backend, **prefijados `CRM_*`** para no mezclarlos con los de calendario.
- **HTTPS ya resuelto**: `reformadental.com` tiene certificado DV válido y vigente (1 feb 2027) que cubre el dominio raíz. Esto es lo que hace viable el montaje: Meta exige TLS de CA pública en el webhook y en el redirect URI de OAuth.
- **CORS**: el backend ya responde `access-control-allow-credentials: true`. Falta confirmar que la allowlist de origins incluya al dashboard, ya que el CRM sigue siendo cross-site (`e-commetrics.com` vs `reformadental.com` son dominios registrables distintos) y la cookie `SameSite=None; Secure` sigue siendo obligatoria.

## 3. Inventario actual

### 3.1 API routes (`src/app/api/*`) — 15 handlers a traducir a Express

Mounted en el router de Reforma con `app.use('/crm', crmRouter)`.

| Handler | Endpoint destino (`/crm/*`) | Verbo real en el código |
|---|---|---|
| `api/leads/route.ts` | `/leads` | `GET`, `POST` |
| `api/leads/[id]/route.ts` | `/leads/:id` | `GET`, **`PATCH`** |
| `api/leads/[id]/send/route.ts` | `/leads/:id/send` | `POST` |
| `api/leads/export/route.ts` | `/leads/export` (CSV) | `GET` |
| `api/import-csv/route.ts` | `/leads/import` | `POST` |
| `api/tasks/route.ts` | `/tasks` | **`GET` únicamente** |
| `api/tasks/[id]/route.ts` | `/tasks/:id` | **`PATCH`** |
| `api/dashboard/route.ts` | `/dashboard` | `GET` |
| `api/settings/route.ts` | `/settings` | **`GET` únicamente** |
| `api/settings/templates/route.ts` | `/templates` | **`PATCH`** (upsert por `key`+`channel`) |
| `api/settings/rules/[id]/route.ts` | `/rules/:id` | **`PATCH`** (upsert) |
| `api/sync/route.ts` | `/sync` | `POST` |
| `api/check-token/route.ts` | `/check-token` | **`POST`** (no `GET`) |
| `api/capi-test/route.ts` | `/capi-test` | `POST` |
| `api/messaging-test/route.ts` | `/messaging-test` | `POST` |

> **Inventario verificado contra el código** (2026-09-25). La columna de verbos está corregida: la versión anterior de este documento declaraba `DELETE /leads/:id`, `POST /tasks`, `DELETE /tasks/:id`, `PUT /settings`, `PUT /templates`, `PUT/DELETE /rules/:id` y `GET /check-token`, **ninguno de los cuales existe**. La API actual **no tiene un solo `DELETE`**. No se deben construir endpoints que hoy no hay.
>
> `GET /crm/settings` **no devuelve una entidad**: es una proyección recalculada en cada request a partir de `automation_rules` + `templates` + `sync_state` + `stages` + `configured` (derivado de `process.env`). No existe tabla `settings`; el dashboard consume ese objeto, no una fila.

Rutas adicionales que **no existen hoy** en el CRM y hay que crear de cero para el onboarding de WhatsApp:

| Ruta nueva | Propósito |
|---|---|
| `POST /crm/whatsapp/onboard/start` | Inicia Embedded Signup v4 (`featureType: whatsapp_business_app_onboarding`) |
| `GET /crm/whatsapp/onboard/callback` | Redirect URI OAuth de Meta; canjea el código y persiste el token |
| `GET /crm/whatsapp/webhook` | Verificación del webhook (`hub.verify_token` / `hub.challenge`) |
| `POST /crm/whatsapp/webhook` | Eventos entrantes de WhatsApp Business |
| `GET /crm/auth/login` + `POST /crm/auth/logout` + `GET /crm/auth/me` | Sesión propia del CRM |

### 3.2 Lógica de datos (`src/lib/*`)

| Módulo | Destino |
|---|---|
| `lib/db.ts` | `db/connection.ts` + `db/schema.sql` (MySQL) |
| `lib/types.ts` | `types/index.ts` |
| `lib/automation.ts` | `services/automation.ts` |
| `lib/scheduler.ts` | `scheduler.ts` (arrancado por Passenger) |
| `lib/facebookSync.ts` | `services/facebookSync.ts` |
| `lib/facebookCapi.ts` | `services/facebookCapi.ts` |
| `lib/leads.ts` | `services/leads.ts` |
| `lib/messaging/{email,sms,whatsapp,index}.ts` | `services/messaging/*` |
| `src/data/db.json` | Dato existente → migrar a MySQL |

### 3.3 UI (`src/app/components/*`)

`AppShell`, `PipelineBoard`, `LeadCard`, `TasksPanel`, `AddLeadModal`, `SendMessageModal` → se copian al webapp del dashboard **manteniendo el look actual del CRM** (NextUI + paleta Reforma).

### 3.4 Páginas actuales

`/` (pipeline), `/leads/[id]`, `/settings`, `/dashboard` → `/dashboard/webapp/reforma-crm/*`

## 4. Fase 1 — Módulo `crm/` integrado en el Express de Reforma

> **Cambio de arquitectura.** Este módulo **no** es una Node.js App aparte. Se integra en el backend de producción existente de `reformadental.com` como un router montado con `app.use('/crm', crmRouter)`. No hay build con Bun, no hay `dist/index.js`, no hay subdominio, no hay alta en cPanel de una app nueva.

### 4.0 Fase 0 previa — Rescate y control de versiones (bloqueante)

El backend de Reforma **vive hoy como un archivo único en producción, sin repositorio**. Antes de escribir una línea:

1. Descargar el archivo a la máquina local.
2. `git init` + primer commit, para que exista diff y rollback.
3. Mapear y documentar antes de tocar nada:
   - Versión de **Node que corre Passenger** en ese app. Si es 14.x (EOL desde abril 2023), hay que subirla, y eso **ya es una edición de riesgo** sobre el archivo de producción.
   - Si el archivo ya usa `node-cron` y con qué jobs, para no duplicar ni pisar el cron del calendario.
   - Cómo carga el `.env` y si hay un `.env.example`.
   - Configuración de MySQL existente y si ya hay un `pool`.
   - Si existe algún middleware de auth reutilizable (casi seguro que no).
4. **Backup del archivo en el servidor** antes de cualquier deploy.

Sin esto, cualquier cambio es un `sed` a ciegas sobre el backend que maneja el calendario de producción.

### 4.1 Estructura del módulo

```
crm/
├── index.ts              → crmRouter: monta auth → endpoints → errorHandler
├── auth.ts               → bcrypt + JWT en cookie httpOnly
├── db/
│   ├── connection.ts     → pool mysql2 con schema `reforma_dental_crm`
│   └── schema.sql        → DDL, sin CREATE DATABASE / USE
├── routes/               → leads, tasks, dashboard, settings, sync, tests, whatsapp
├── services/             → facebookSync, facebookCapi, automation, leads, messaging/*
└── scheduler.ts          → node-cron del CRM (sync FB 5 min, token check diario)
```

### 4.2 Puntos de montaje

1. **Router**: `app.use('/crm', crmRouter)`. Verificar que ninguna ruta actual de Reforma empieza por `/crm`. Hoy existen `/api/appointments`, `/api/appointments-dashboard`, `/fechas-bloqueadas`, `/bloquear-fecha`, `/desbloquear-fecha` — ninguna colisiona.
2. **Base de datos**: `reforma_dental_crm`, con **usuario y grants propios**. Es deliberado: un `DROP` o un `TRUNCATE` del CRM no debe poder tocar los datos del calendario. En cPanel el nombre real lleva prefijo de usuario (`<usuario>_reforma_dental_crm`), así que `DB_NAME` se define por variable de entorno, no literal.
3. **Schema**: `leads`, `tasks`, `activities`, `stages`, `automation_rules`, `templates`, `sync_state`, **`users_crm`**. Los defaults de `lib/db.ts` (6 stages, 5 reglas, 6 plantillas) van como seed.
4. **Endpoints `/crm/*`**: los 15 handlers de la sección 3.1, más las 5 rutas nuevas de WhatsApp y auth listadas ahí.
5. **Auth propia** (P0, antes de exponer la primera ruta): `users_crm` con bcrypt, login/logout/me, JWT en cookie `httpOnly` **`SameSite=None; Secure`**. Sin esto, `GET /crm/leads` publica PII de clientes y `POST /crm/leads/:id/send` deja gastar presupuesto de Twilio/Meta a cualquiera.
6. **`.env`**: variables del CRM **prefijadas `CRM_`** (SMTP, Twilio, WhatsApp, FB, `JWT_SECRET`, `DB_*`) para no colisionar con las del calendario.
7. **CORS**: el backend ya responde `access-control-allow-credentials: true`. **Falta verificar** que la allowlist de origins incluya la del dashboard y que `/crm/*` quede cubierta por ella.
8. **`process.exit`**: prohibido en fallos de arranque. Passenger entra en restart loop y tumba también el calendario.

## 5. Fase 2 — Webapp del CRM en el dashboard

1. `src/app/dashboard/webapp/reforma-crm/page.tsx` — pipeline board + tasks (look actual).
2. `src/app/dashboard/webapp/reforma-crm/leads/page.tsx` — detalle de lead **por query param** (`?lead=ID`), no ruta dinámica (un static export no la resuelve en runtime).
3. `src/app/dashboard/webapp/reforma-crm/settings/page.tsx` — reglas, plantillas, integraciones, estado de sync.
4. `const CRM_API_URL` al tope de cada página → todos los `fetch`/axios apuntan al backend del CRM (antes rutas relativas `/api/*`).
5. Login propio del CRM dentro del webapp (cookie `httpOnly`, cross-site contra `reformadental.com`).
6. `src/components/app-sidebar.tsx` — nuevo `AppItem`: `component: "ReformaCRM"` (URL `/dashboard/webapp/reforma-crm`).
7. `src/app/dashboard/access-app/page.tsx` — registrar el ID de componente en `AVAILABLE_COMPONENTS`.
8. `.env` del dashboard: `CRM_API_URL=https://reformadental.com` (mismo patrón que `calendar-reforma`, que ya usa `https://reformadental.com`). El webapp llamará a `https://reformadental.com/crm/*`. Con `withCredentials: true` en cada request.

## 6. Fase 3 — Verificación

- **Regresión primero**: antes de tocar nada, `GET /api/appointments` y `GET /fechas-bloqueadas` deben seguir respondiendo `200` idéntico. Este es el smoke test que corre en cada deploy, porque el backend es compartido.
- **CRM**: `GET /crm/settings` (o un `/crm/health` propio) responde `200`, login emite cookie, y **un endpoint protegido devuelve `401` sin cookie**. Ese `401` es la prueba de que la auth está puesta.
- **Dashboard**: `bun run build` (export estático sin errores de rutas dinámicas), `bun run lint`.
- Flujo completo: login dashboard → webapp CRM → login CRM → CRUD de leads/tasks → envío de mensajes → sync manual.
- **Aislamiento de base**: confirmar con un usuario MySQL del CRM que `USE reforma_dental_crm` no le deja leer las tablas del calendario.

## 7. Fase 4 — Deploy

1. **Orden obligatorio**: primero el backend (montar `/crm`), verificar que el calendario sigue bien, y después el dashboard. Nunca al revés — si el CRM se monta y el dashboard ya apunta a `CRM_API_URL`, hay una ventana en la que el webapp llama a rutas inexistentes.
2. **Dashboard estático**: build local (`bun run build`) → subir la carpeta `out/` completa a `public_html`. Deep links funcionan sin `.htaccess` de rewrites porque Next genera carpetas físicas (`reforma-crm/index.html`).
3. **MySQL**: en cPanel → **MySQL Databases** crear `reforma_dental_crm` y un usuario dedicado con grants solo sobre esa base (host `localhost`). Luego `db/schema.sql` (**sin** `CREATE DATABASE` / `USE` — cPanel no lo permite desde SQL) → seed inicial.
4. **Backend**: subir el módulo `crm/` al servidor y el `require`/import en el archivo raíz del Express de Reforma. **Sin build**: es TypeScript/JS directo servido por Passenger, no un bundle.
5. **Reiniciar la app Node** en cPanel → **Setup Node.js App → Restart**. Un `require` nuevo necesita reinicio; Passenger no hace hot reload.
6. **`.env`**: añadir las variables `CRM_*` al archivo existente, sin tocar las del calendario.
7. **HTTPS**: ya activo y válido en `reformadental.com` (DV Sectigo, cubre el dominio raíz, vigente hasta feb 2027). **No hay nada que hacer.** Esto es la diferencia clave frente a la arquitectura de subdominio, que habría exigido comprar e instalar un certificado manual porque ese host no tiene AutoSSL.
8. **Verificación**: `curl -I https://reformadental.com/crm/settings` (o `/crm/health`), más el smoke test del calendario.
9. `NEXT_PUBLIC_URL` y `CRM_API_URL` se hornean en build → si cambian, rebuild + re-subir `out/`.
10. **Limpieza opcional**: borrar el subdominio `api.reformadental.com` y la Node.js App placeholder de cPanel, ya que quedaron sin uso.

## 8. Decisiones tomadas

| Decisión | Valor |
|---|---|
| Base de datos del CRM | `reforma_dental_crm`, MySQL propia, **usuario y grants separados** de los del calendario |
| URL del backend | **Definida**: `https://reformadental.com` — el Express de producción que ya existe |
| Namespace | `https://reformadental.com/crm/*` |
| Subdominio propio | **Descartado**. `api.reformadental.com` queda sin uso; el host no tiene AutoSSL y habría exigido comprar/instalar un certificado manual |
| Coexistencia con Reforma | El CRM comparte proceso, cron y despliegue con el calendario. Un fallo de arranque del CRM afecta al calendario |
| Uso de la URL | Solo el CRM; el dashboard consume vía `CRM_API_URL` dentro del webapp |
| Permiso de acceso | Webapp **nuevo** (`ReformaCRM`), independiente del calendario |
| Diseño | Mantener look actual del CRM (NextUI + paleta Reforma) |
| Autenticación | Login propio del CRM, JWT en cookie `httpOnly; SameSite=None; Secure`, aplicado a **todas** las rutas `/crm/*` |
| Integración UI | **Opción A**: CRM dentro del `out/` del dashboard (`/dashboard/webapp/reforma-crm`) |
| Deploy | Frontend estático en `public_html` + módulo `crm/` subido al Express de Reforma, sin build ni Node.js App nueva |

> **Por qué se descartó el subdominio** (2026-09-25): el diseño original era un backend aparte en `api.reformadental.com`. Al verificar la infraestructura resultó que `reformadental.com` **ya es** un backend Express + Passenger con TLS válido (`ssl_verify=0`) y CORS con credenciales, y que en toda la organización el backend vive en el dominio raíz de cada marca (`reformadental.com`, `palmasrecovery.com`, `mongeortopedia.com`, `scaneat.mx`). Montar en `/crm/*` elimina el problema de SSL por completo y sigue el patrón ya establecido. El costo es compartir proceso con el calendario, y por eso la Fase 0 previa (rescate + git + backup) es bloqueante.

## 9. Riesgos / pendientes

### Bloqueantes

- **El backend de Reforma no está versionado.** Es un archivo único en producción. Sin `git init` + backup, cualquier cambio es edición a ciegas sobre el calendario. → Fase 0.
- **Auth ausente.** El CRM hoy tiene cero autenticación y su README dice que es solo para localhost. Publicarlo en un Express abierto expone PII de clientes y permite gastar presupuesto de Twilio/Meta anónimamente. **P0 absoluto.**
- **Versión de Node de Passenger en el host.** Si es 14.x (EOL), subirla es en sí una edición de riesgo sobre producción, y `mysql2` v3 requiere Node 16+.
- **Volumen de deploys compartidos.** Un `require` roto, una dependencia faltante o un `.env` mal editado tumba el calendario, no solo el CRM. Mitigación: orden de deploy backend-primero con smoke test del calendario, y reinicio manual controlado.

### Pendientes

- **Migración de datos**: dump de `src/data/db.json` a MySQL (seed/INSERT). Es el único juego de datos existente y está gitignored.
- **CORS y cookies cross-origin**: verificar la allowlist de origins del backend existente, ampliar a `/crm/*` y mantener `SameSite=None; Secure`. Ya responde `access-control-allow-credentials: true`.
- **Cron compartido**: confirmar que el CRM no pisa los jobs de `node-cron` del calendario. Usar express de nombres distintos.
- **Rutas dinámicas**: el detalle de lead usa query param por limitación del static export.
- **Primera migración de esquema**: los IDs seed de reglas/plantillas deben ser estables antes de aplicar.
- **`src/data/schema.sql` incompleto**: le faltan las columnas `whatsapp_template_name` y `whatsapp_template_language` que usa `settings/templates/route.ts` y lee `whatsapp.ts`; y `automation_rules` debe tener PK en `key`, no en el `nanoid()` de `db.ts` (o cada seed genera IDs distintos).
- **Onboarding de WhatsApp**: sigue sin resolverse si el número `1332188503303466` es un caso (a) —verificado y desvinculado, resoluble con un `POST /{id}/register`— o un caso (c) —registrado en la app de WhatsApp, que exige Coexistence con Embedded Signup v4, Tech Provider, webhook y callback OAuth. **El diagnóstico del Phone Number ID va antes de construir nada de esto.**
# STREEX — HANDOFF maestro

Checkpoint: 2026-10-20. S01–S04 están HECHAS; S04 cerró con lockfile Bun v3, instalación congelada y checks completos, y una excepción explícita para `esbuild@0.27.7` (alerta baja, dev server Windows-only; Vite 7 requiere `^0.27.0`). `brace-expansion` quedó corregido en sus ramas 1.x y 5.x. `package.json` fija Bun 1.4.3, que CI instala desde `packageManager`. S02.3 está validada en Production para aceptación, rechazo, reintento idempotente y Calendar. P01: Production carga Maps, pero Places Autocomplete responde 403 `PERMISSION_DENIED`; variables Vercel asignadas, valores no inspeccionados; configuración de Geocoding server-side no probada. La entrada pública `getstreex.com` fue redirigida a Rides en Cloudflare. Rama: main. Baseline de auditoría: c38d98f (feat(passenger): deepen private analytics).

## Reanudar aquí

**Siguiente subpaso: S05.2-CI — ejecutar la migración y las pruebas pgTAP en Supabase local aislado mediante GitHub Actions.** Modelo recomendado: **Terra, razonamiento Alto**. Si pasa, seguir con S05.1-R para verificar el estado efectivo remoto de Rides; no aplicar la migración a Production hasta revisar esa diferencia y obtener la validación autorizada.

El audit original compartido por el propietario identificó 13 familias vulnerables. S04.2 actualizó los paquetes afectados y dejó un único advisory bajo de `esbuild`, documentado como excepción por el rango vigente de Vite 7. El lockfile y los checks están validados con Bun 1.4.3; no se requiere repetir la auditoría inicial.

S04 está cerrada con excepción documentada. `brace-expansion` se fijó por rango en `1.1.21` y `5.0.12`; `bun audit` confirma que solo queda `esbuild@0.27.7`, alerta baja del servidor de desarrollo Windows. No forzar `esbuild@0.28.1` fuera del rango de Vite 7 (`^0.27.0`); reevaluar cuando se actualice Vite/TanStack de forma compatible.

La siguiente fase no debe empezar con escrituras de producción: verificar primero los grants/policies remotos y diseñar pruebas sintéticas aisladas para Data API, suspensión y bypass de handlers. Passenger y Horizon permanecen fuera del alcance de S05.

Evidencia S03 (2026-10-20): commit `e9ca698` publicado en `main`. Se formatearon exclusivamente `WeatherAtmosphere.tsx`, `usePassengerState.ts`, `weather.server.ts` y `weather.ts`; se configuró el preload ya existente `tests/no-network.preload.mjs` en el workflow de calidad. Prettier y `git diff --check` pasan; la suite completa pasa con 86 tests/2203 assertions. GitHub Actions run `39481034552` terminó success en Typecheck, Lint, Test y Build. Los comandos locales de typecheck/build quedaron sin salida en esta máquina, pero el run remoto concluyó todas las etapas en verde. No se alteró comportamiento de Passenger.

Evidencia S04.1/P01 (2026-10-20): `bun pm why` confirma `seroval@1.6.9` y `@tanstack/start-server-core@1.169.39`; los advisories enlazados en la auditoría fijan versiones mínimas corregidas inferiores a las resueltas actuales. `bun audit --json` falló con `ConnectionRefused`; no se cambió `package.json` ni `bun.lock`. P01 añadió clasificación segura de HTTP/API status, `ZERO_RESULTS`, errores de red y timeout en `pricing-maps.server.ts`, más cuatro pruebas simuladas; `GOOGLE_MAPS_SERVER_KEY` quedó documentada en `.env.example`. La suite completa local con preload pasa 90/90. No se hizo una llamada Google real. El conector Vercel devolvió 403 por falta de acceso a `juangaudinos-projects`; no hay CLI `vercel` instalada, por lo que el entorno Production, logs y status de la clave siguen sin verificar. La comprobación local actual no encuentra `GOOGLE_MAPS_SERVER_KEY`; una variable browser (presente o ausente) no demuestra configuración Production ni reemplaza la clave server-side.

Evidencia S04.2 (2026-10-20): el audit original identificó 13 familias vulnerables. `package.json`/`bun.lock` actualizan Vite 7.3.2→7.3.5 y Sharp 0.34.5→0.35.5, fijan versiones corregidas para Babel core, baseline-browser-mapping, Browserslist, js-yaml, nanoid, PostCSS y source-map-js; la re-resolución excluye el peer opcional Miniflare incompatible descrito arriba. Se actualizó `packageManager` a Bun 1.4.3 y el lockfile a v3 para permitir overrides por rango: `brace-expansion@1.1.21` satisface la rama minimatch 3 y `brace-expansion@5.0.12` la rama minimatch 10. `bun audit` con Bun 1.4.3 confirma una sola alerta residual, `esbuild@0.27.7`, de severidad baja, limitada al dev server en Windows; Vite 7.3.5 requiere `^0.27.0`, por lo que no se fuerza la versión 0.28.1. `bun install --frozen-lockfile` pasa; `bun pm why brace-expansion` confirma ambas versiones corregidas; typecheck pasa; tests pasan (90/90, 2222 assertions); lint termina sin errores y deja 6 advertencias de Fast Refresh; build Vite/Nitro para Vercel pasa; `git diff --check` pasa. El Bun global del propietario se actualizó a 1.4.3 para que el lockfile nuevo sea instalable localmente. No hubo cambios funcionales ni modificaciones a Passenger/Horizon. Modelo de la fase: **Terra, razonamiento Alto**; Astra no fue necesario.

Evidencia S05.1 (2026-10-20; fuente local, remoto no verificable): la migración `20260715035104_multi_tenant_super_admin.sql` habilita RLS y políticas tenant-scoped, pero concede permisos DML a `authenticated` en `bookings`, `reviews`, `app_settings`, `tenant_availability` y `blocked_slots`, junto con políticas de miembros `FOR ALL`; `status <> 'suspended'` también incluye membresías `invited`. Una búsqueda de todos los accesos `.from()` encontró estas cinco tablas únicamente en módulos/funciones server-side que usan `supabaseAdmin`; no se encontró uso directo del cliente browser. Un token autenticado podría, no obstante, acceder a Data API si los grants están efectivos y mutar datos fuera de la lógica de negocio. No se probó acceso cross-tenant ni se consultó una fila real. El conector lista solo `streex-aura-persona`, no Rides (`qoxczvfthlhwymygdsvi`); `supabase projects list` falló con `Transport error` y un `SELECT current_database(), current_user` directo a Rides fue rechazado con `You do not have permission to perform this action`. Como mitigación en el código, se preparó `20261020203512_restrict_sensitive_table_api_access.sql`: concede DML explícito a `service_role`, revoca privilegios de tabla a `anon`/`authenticated` y elimina las políticas conocidas en esas cinco tablas; se agregó una prueba pgTAP para comprobarlo en un stack aislado y un workflow CI dedicado. El test aún no se ha ejecutado; la máquina local carece de Docker. No se modificó la base remota y la migración no se aplicó a Production. Tras el primer CI, seguir verificando el esquema/grants efectivos de Rides antes de cualquier aplicación de producción.

Avance P01 (2026-10-20, verificación directa posterior): la comprobación local no encuentra un valor no vacío para `GOOGLE_MAPS_SERVER_KEY` en `.env`. Se añadió una prueba que asegura que su ausencia produce un error explícito sin solicitud de red; `bun test tests/pricing-maps.test.mjs` pasa 5/5 y `git diff --check` pasa. La sesión autenticada de Vercel permite confirmar metadatos (sin revelar valores): `GOOGLE_MAPS_SERVER_KEY` está asignada a Production, Preview y Development; `VITE_GOOGLE_MAPS_BROWSER_KEY` está asignada a Production y Preview. El formulario real de Production, probado una sola vez con la dirección pública “Salt Lake City International Airport” y sin enviar reserva, falla en autocomplete. Safari Web Inspector registró `403` del endpoint `places.googleapis.com/$rpc/google.maps.places.v1.Places/AutocompletePlaces` y `RpcError(PERMISSION_DENIED): The caller does not have permission`. Por tanto, ya no es correcto describir el único problema como “configuración de Production no verificada”: la variable existe, pero su valor efectivo/permisos de Google Cloud no se pudieron inspeccionar. La respuesta de servidor y la validez de `GOOGLE_MAPS_SERVER_KEY` siguen sin probarse. No se reveló ni cambió ningún secreto/configuración, no hubo llamadas repetidas ni se creó una reserva. Causa probable aún por aislar en Google Cloud (API habilitada, restricciones de API/referrer/proyecto o autorización); no aplicar cambios hasta verificar el proyecto exacto y el diagnóstico del proveedor.

S02.1 decidida: 72 horas y enlaces UUID heredados neutrales, con reemisión manual. S02.2 implementada: `/booking/accept` y `/booking/decline` sólo consultan estado al abrirse; una acción POST deliberada exige capacidad HMAC vinculada a reserva, acción y caducidad. La transición `quoted` usa compare-and-set para que aceptación/rechazo concurrentes tengan un único ganador; las pantallas heredadas no consultan ni mutan una reserva. Los envíos Admin/Pricing verifican la configuración antes de actualizar la cotización. La clave dedicada fue configurada por el propietario y no fue leída ni verificada directamente durante esta fase; el código conserva el secreto de preview existente como fallback acotado, nunca el secreto de Calendar.

Evidencia S02.3 (2026-10-20; QA de Production reportado por el propietario): la reserva QA de aceptación permaneció `Confirmed`; el correo de la cotización llegó al buzón controlado, abrir Accept Ride no mutó el estado, la confirmación deliberada produjo una sola transición y el reintento mostró la respuesta ya procesada. Para rechazo se creó exactamente una segunda reserva QA, sin despacho, se envió una cotización de prueba de $1.00 al buzón controlado, y Admin pasó a `Quoted`. Abrir Decline Ride en otra pestaña no mutó el estado. Una acción deliberada la cambió a `Declined`; al recargar, la página mostró `Already processed` y Admin siguió `Declined`. El propietario confirmó que el evento Calendar de la reserva aceptada aparece una sola vez. Esta evidencia proviene de observación manual del propietario; no se inspeccionaron datos personales ni se repitió el flujo. La solicitud con Maps mostró que las sugerencias de direcciones no estaban disponibles; P01 sigue abierto.

Infraestructura externa (2026-09-06): Cloudflare contiene una Page Rule activa `getstreex.com/*` → `https://rides.getstreex.com/$1` con 301. Se verificó públicamente por HTTPS y HTTP: ambos redirigen a Rides y el destino responde 200 desde Vercel. Es una configuración externa, no un cambio de código ni una redirección a Passenger.

Prompt reutilizable:

> Continúa en main desde docs/HANDOFF.md, docs/ROADMAP.md y la tarjeta indicada de docs/EXECUTION_PLAN.md. Ejecuta solo la siguiente tarea o subpaso habilitado, respeta sus exclusiones y puntos de parada, valida, actualiza el checkpoint y termina con commit/push del cambio aprobado. No reaudites todo ni ejecutes tareas en standby.

## Fuente de verdad y precedencia

- Instrucción nueva del propietario + guardrails de seguridad prevalecen.
- ROADMAP: único orden, estados, gates y mapping de las 27 recomendaciones.
- EXECUTION_PLAN: único conjunto de tarjetas, pruebas, exclusiones, commits y escaladas.
- HANDOFF: punto actual, evidencia y próxima acción; no crea otra cola.
- PROJECT_CONTEXT y guías técnicas: contratos por dominio, no prioridad alternativa.
- Auditoría y archive: evidencia histórica; sus prioridades o pasos obsoletos no gobiernan la ejecución.

Si el próximo ID aquí y ROADMAP difieren, resolver esa divergencia antes de editar código. Cuando se cierra un ID, mover ambos punteros en el mismo checkpoint. Leer históricos solo para una pregunta de evidencia concreta.

## Qué cambió en este checkpoint

- S01: `src/lib/analytics.ts`, el wiring raíz y `tests/analytics.test.mjs` contienen respuestas/previews antes de inicializar GA y sanearon ubicación/referrer de los eventos permitidos. Evidencia: 5 pruebas focalizadas passing; Prettier focalizado; `bun run check` (typecheck y build) passing; carga local de `/booking/accept?id=synthetic-booking-id` sin `gtag`, `dataLayer` ni script de Google Analytics. No se abrieron enlaces de clientes, no se consultó producción ni se inició telemetría desde una ruta pública para la verificación.

- [Auditoría original](audits/2026-09-05-audit.md) preservada en el repositorio, sin reescribir sus conclusiones ni prioridades históricas. [Cómo interpretarla ahora](audits/README.md).
- Un ROADMAP, un EXECUTION_PLAN y un HANDOFF activos para todos los productos; roadmaps/handoffs previos archivados o convertidos en referencia técnica.
- Corregidos hosting/backend, bootstrap/bypass obsoleto, estado de migración Pricing y descripciones “hidden” de Horizon.
- UX/UI elevado: diseño temprano UX00, responsive Rides explícito, Music/Passenger workstream propio y Clima como referencia.
- Horizon reevaluado en fuente e interfaz pública: reloj/puntaje/pausa, ranking y generación reproducible tienen valor más allá de skins. Sin implementación.
- Comercialización/altas, piloto drivers, billing y evaluación musical SaaS movidos a C01–C05 standby; seguridad actual sigue S05/R03/PA02/R04.

## Estado real por superficie

| Área           | Evidencia / situación                                                                           | Pendiente sin ambigüedad                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Rides          | Landing, solicitudes, reviews y agenda existen; S01/S02 cerrados                                | Accesibilidad y responsive UX01/UX02; no hay fix aplicado por esta consolidación |
| Admin/Auth     | Auth/memberships DB; sin bypass                                                                 | S05 RLS/suspensión y QA directo, S06 configuración autorizada                    |
| Pricing        | Código y migración existentes/aplicados según auditoría                                         | P01–P08 + QA real; no llamar producción-ready por build verde                    |
| Calendar       | OAuth/free-busy/sync confirmed con evidencia histórica de producción                            | R01 duración/buffers y R02 recuperación; no duplicar integración                 |
| Passenger Lite | Music hero, rail, Accent, juegos locales y analytics semánticos implementados                   | PA01/PA02 y UX04/UX05; uso diario/tablet con validación por cambio               |
| Clima          | Climate Premium implementado; benchmark visual confirmado por propietario                       | Conservar jerarquía/atmósferas; pruebas de no regresión, no rediseño nuevo       |
| Music          | Music Reload implementado y fuente Spotify existente                                            | Calidad/estados aún mejorables, no “diseño terminado”; UX04                      |
| Around You     | 32 entradas/config local actual superseden handoffs de 8/19 lugares; enabled, Home-only en Lite | QA de campo específico B07/B02; no reactivar watchPosition ni GPS de históricos  |
| Horizon        | Canvas 2D/tres carriles, intro/game/results, QR tablet y records moderados                      | H01 corrección temporal; H02 UX/ranking; H03 piloto opcional; no reescritura     |
| SaaS           | Cimientos multi-tenant existen                                                                  | Comercialización explícitamente standby; no alta de nuevos conductores           |

## Evidencia reutilizable: no repetir sin motivo

Auditoría original del 2026-09-05, baseline c38d98f:

- 60 pruebas en 14 archivos passing; typecheck/build passing.
- Lint: 7 errores de formato y 6 warnings; CI inspeccionado fallaba en lint. No se arregla en este commit documental.
- Audit dependencias: 13 paquetes / 39 entradas de avisos; detalle/alcance en auditoría, no prueba de explotación real.
- Supabase leído: migraciones/tabla Pricing aplicadas, políticas y asesores. No repetir aplicación/reparación histórica. La autorización efectiva actual de Maps sigue sin confirmar.
- Payload vinculado y fechas Pricing reproducidos localmente; no se enviaron cotizaciones reales para la auditoría.
- Admin autenticado no fue recorrido end-to-end; tablet física, Spotify paired, backups y performance de campo no se certificaron de nuevo.

Consolidación actual:

- Solo inspección focal de Horizon/Clima/Music y documentación. No se repitieron tests/build/audit de la aplicación ni consultas Supabase.
- Horizon tuvo una partida de observación en navegador sin guardar/publicar score ni compartir tarjeta. Resultado mostró rank con leaderboard approved vacío, consistente con la diferencia de queries en fuente. No es benchmark de FPS.
- Passenger idle/rail observado; no se consiguió reabrir de forma fiable el detalle Clima/Music en esa sesión automatizada sin emparejar. Su valoración usa fuente y referencia explícita del propietario; no afirmar QA completo del reproductor ni inventar un fallo de tablet.
- Validación documental de cierre D00: 58 enlaces locales comprobados en 15 documentos; 27 recomendaciones trazadas y 46 IDs de trabajo (incluidos backlog/standby) con tarjeta o contrato de reactivación; copia de auditoría idéntica byte a byte; Prettier pasa en los 13 documentos activos seleccionados; git diff --check pasa. Diff de src/, public/, package.json, bun.lock y supabase/migrations vacío. No se ejecutó otra batería local del producto.

## Decisiones pendientes con parada localizada

- P04: tarifas reales/Hourly sin destino, stops, zonas superpuestas, positioning retorno, referral y overrides; no usar números temporales como precios aprobados.
- P08.1: cuándo una quote es enviada, cómo reservar/consumir promo y cómo recuperar fallo incierto de email.
- R01.1: duración/buffer/capacidad, holds y expiración.
- R02: restaurar eventos Google manualmente vs automático. Mantener decisión explícita, no inferir autoridad por un webhook.
- UX00/UX04/UX05/H02: aprobación visual de la región antes de implementación; referencia Clima no autoriza rediseñar todo.
- H01.1: scoreVersion y convivencia con récords legacy, sin borrarlos.
- PA02/O03/B07: dispositivos/credenciales/bridge requieren autorización y prueba real. No asumir capacidades físicas del navegador.

## Operación Passenger: no reiniciar por rutina

El historial registra beta analytics y pairing ya utilizados; no repetir Start beta measurement ni borrar cookies/storage para “limpiar QA”. Mantener la distinción sesión técnica / engagement / viaje confirmado.

Rutina previamente acordada: checkpoint semanal y renovación de pairing Passenger/Spotify cada 28 días desde la última fecha confirmada. No se revalidó en este checkpoint la fecha del último pairing; pedir/registrar esa fecha solo si corresponde mantenimiento, no crear recordatorios ni reemparejar hoy por defecto. Fully backup se prueba en dispositivo de repuesto/reinstalación autorizada, no arriesgando la única tablet operativa.

## Git y cierre de cambios

En este checkpoint el worktree inició limpio en `main`; `supabase/.temp/cli-latest` no tenía cambios. S01 incluye Analytics y sus pruebas. S02.2 incluye Booking y sus pruebas focalizadas. S02.3 queda cerrado con QA reportado por el propietario; no se modificó código, migraciones ni secretos para esta validación. La configuración de `BOOKING_RESPONSE_TOKEN_SECRET` permanece fuera del repositorio.

Identificar el commit documental por el mensaje `docs: consolidate STREEX execution roadmap and checkpoint`; no confundirlo con código implementado. Hash/push/CI de la entrega se informan al cerrar D00. Una CI roja por el lint histórico no significa que las correcciones S03 estén hechas.

Plantilla para cada actualización futura:

| Campo              | Registrar                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| ID/subpaso cerrado | Alcance exacto, archivos y decisión aprobada                             |
| Evidencia          | Comandos/resultados, QA/browser/tablet, fechas/entorno, sin PII          |
| Persistencia       | Migración no requerida/preparada/aplicada; commit no equivale a aplicada |
| Git/CI             | Commit, push verificado y resultado real; deuda previa vs regresión      |
| Estado             | HECHA / VALIDACIÓN PENDIENTE / bloqueo concreto                          |
| Próximo ID/subpaso | Uno solo; dependencies resueltas y modelo/razonamiento                   |
| Límites            | Qué no tocar y siguiente punto de autorización                           |

## Retorno de Astra

No volver por cada task. G1 revisión con Astra solo si quedan conflictos transversales de alto riesgo o Terra no logra cerrarlos con evidencia. Final V01: F1–F5 verificadas, F6 realizado o diferido explícitamente, SaaS standby; entregar evidencia y pedir reauditoría read-only contra diagnóstico original, no implementación automática. Ver [condiciones completas](EXECUTION_PLAN.md#cuándo-debe-volver-astra).

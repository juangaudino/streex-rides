# STREEX — HANDOFF maestro

Checkpoint: 2026-10-20. S01–S03 están HECHAS; S03 cerró con formateo acotado y CI verde. S02 quedó validada con QA controlado de aceptación, rechazo, reintento idempotente y Calendar. La entrada pública `getstreex.com` fue redirigida a Rides en Cloudflare. Rama: main. Baseline de auditoría: c38d98f (feat(passenger): deepen private analytics). No se modificaron lógica de producto, Pricing, Horizon ni migraciones en S03.

## Reanudar aquí

**Siguiente ID: S04 — dependencias afectadas, actualización compatible dirigida.**

S03 está HECHA. Para S04, revalidar los advisories actuales de las familias TanStack/Seroval identificadas por la auditoría, confirmar las versiones resueltas y preparar la actualización compatible mínima. No hacer upgrades mayores indiscriminados; detenerse y presentar el impacto si se requiere un cambio mayor. Modelo recomendado: **Terra, razonamiento Alto** por compatibilidad SSR y server functions.

1. Leer [AGENTS](../AGENTS.md), [ROADMAP](ROADMAP.md) y la [tarjeta S04](EXECUTION_PLAN.md#s04--dependencias-vulnerables-dirigidas).
2. Verificar advisories/versiones vigentes solo para las familias afectadas y mapear el árbol de dependencias actual.
3. Separar vulnerabilidades de runtime/deploy de hallazgos dev/transitivos; no inferir explotabilidad solo desde el conteo del audit.
4. Aplicar actualizaciones compatibles dirigidas, validar árbol y lockfile, SSR, auth, server functions, rutas de reserva/Pricing y build. Si hace falta un major o no puede conservarse compatibilidad, detenerse con evidencia y alternativas.

Evidencia S03 (2026-10-20): commit `e9ca698` publicado en `main`. Se formatearon exclusivamente `WeatherAtmosphere.tsx`, `usePassengerState.ts`, `weather.server.ts` y `weather.ts`; se configuró el preload ya existente `tests/no-network.preload.mjs` en el workflow de calidad. Prettier y `git diff --check` pasan; la suite completa pasa con 86 tests/2203 assertions. GitHub Actions run `39481034552` terminó success en Typecheck, Lint, Test y Build. Los comandos locales de typecheck/build quedaron sin salida en esta máquina, pero el run remoto concluyó todas las etapas en verde. No se alteró comportamiento de Passenger.

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

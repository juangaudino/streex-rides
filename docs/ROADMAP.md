# STREEX — ROADMAP maestro

Actualizado: 2026-10-20. Única autoridad documental de prioridad y estado para Rides, Pricing/Admin, Passenger y Horizon. Sustituye los roadmaps por producto. [HANDOFF](HANDOFF.md) indica dónde retomar; [EXECUTION_PLAN](EXECUTION_PLAN.md) define cómo ejecutar cada ID.

## Decisiones que gobiernan el orden

1. Optimizar la operación real de Juan, no lanzar SaaS ahora.
2. Seguridad, integridad monetaria, permisos, reservas y agenda preceden cambios visuales de producto.
3. UX/UI tiene definición temprana (UX00 después de F1) e implementación propia (F4/F5), sin esperar SaaS ni toda optimización opcional. Clima es referencia de acabado; Music no está visualmente cerrado. Rides responsive desktop/tablet es un problema explícito, no pulido opcional.
4. Passenger importa por la experiencia actual. Horizon pasa de “no tocar el motor por defecto” a evolución controlada: conservar Canvas/tres carriles, corregir reloj/puntaje, y explorar variedad reproducible sin reescritura.
5. Seguridad de tenants existentes NO entra en standby. Onboarding comercial, cobro SaaS y expansión multioperador sí.
6. Un ID atómico por vez. Ninguna fila autoriza por sí sola una migración, credencial, despliegue, pago o envío real. La instrucción futura de continuar autoriza solo el siguiente ID habilitado, con los puntos de parada de su tarjeta.

## Estados

- LISTA: siguiente tarea ejecutable al recibir orden de avanzar.
- PLANIFICADA: no iniciada; respetar dependencias y aprobación de alcance.
- DECISIÓN: necesita elección concreta del propietario antes de la parte indicada.
- VALIDACIÓN PENDIENTE: implementada, pero falta evidencia de la capa indicada; no es HECHA.
- STANDBY: conservada, no ejecutar sin reactivación explícita.
- HECHA: criterios y evidencia registrados en HANDOFF, commit/checkpoint asociado.

No interpretar el orden dentro del informe histórico como prioridad vigente. No duplicar esta tabla en otro roadmap. Las tarjetas del plan no mantienen una segunda columna de estados.

## Cola única de ejecución

### F0 — checkpoint documental

| ID  | Tarea                                                                   | Estado                                                                               |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D00 | Auditoría preservada, planes unificados, reevaluación Horizon y handoff | HECHA — checkpoint documental 2026-09-05; no recomendaciones de código implementadas |

### F1 — contención y seguridad actual

| ID  | Tarea                                                                          | Prioridad | Estado                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S01 | Analytics: excluir respuestas/previews y sanear URLs/referrers                 | P0        | HECHA — pruebas focalizadas, build y carga local sintética verificados                                                                                 |
| S02 | Respuesta a cotización: GET neutral, acción deliberada, token y compatibilidad | P0        | HECHA — S02.1/S02.2 implementadas y S02.3 QA de aceptación, rechazo, reintento idempotente y Calendar completado el 2026-10-20                         |
| S03 | Formato acotado y CI/checks coherentes                                         | P1        | HECHA — formato limitado, preload de test configurado y GitHub Actions verde en e9ca698                                                                |
| S04 | Dependencias afectadas, actualización compatible dirigida                      | P1        | VALIDACIÓN PENDIENTE — Seroval/TanStack conocidos ya están en versiones corregidas; auditoría completa no disponible por conexión al servicio advisory |
| S05 | Matriz de permisos, RLS y suspensión/archivo, Data API y Storage               | P1        | PRELIMINAR — grants DML a authenticated; validar Data API y bypass aislado                                                                             |
| S06 | Protección de contraseña y recuperación administrativa                         | P1        | PLANIFICADA; requiere configuración autorizada                                                                                                         |

Gate G0: contención y controles críticos de acceso verificados; ninguna regresión nueva. Una indisponibilidad externa de S06 debe declararse y ser aceptada, no bloquear artificialmente diagnóstico local de Pricing. Un P0 sin cerrar sí bloquea cualquier ampliación.

### UX temprano — definición, no implementación de superficies

| ID   | Tarea                                                              | Prioridad   | Estado                                                                  |
| ---- | ------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------- |
| UX00 | Contrato visual y matriz responsive, tomando Clima como referencia | P1 producto | PLANIFICADA después de G0; prototipo/acuerdo, sin cambiar funcionalidad |

Después de UX00 se vuelve a F2. No encadenar rediseños mientras siga abierto riesgo de dinero/reservas.

### F2 — Pricing y ciclo monetario

| ID  | Tarea                                                      | Prioridad | Estado                                                                                 |
| --- | ---------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| P01 | Diagnóstico Geocoding y observabilidad saneada             | P1        | VALIDACIÓN PENDIENTE — instrumentación local lista; Maps real/Production sin verificar |
| P02 | Payload/visualización de cotización vinculada              | P1        | PLANIFICADA                                                                            |
| P03 | Timezone y vigencias                                       | P1        | PLANIFICADA                                                                            |
| P04 | Contrato tarifario con ejemplos aprobados                  | P1        | DECISIÓN — ejemplos y reglas, no tarifas inventadas                                    |
| P05 | Implementar gaps de reglas acordados en P04                | P1        | PLANIFICADA                                                                            |
| P06 | Cálculo vigente, invalidación y override explícito         | P1        | PLANIFICADA                                                                            |
| P07 | Rechazo/completado y lifecycle de Pricing consistente      | P1        | PLANIFICADA                                                                            |
| P08 | Transiciones, persistencia atómica e idempotencia de envío | P1        | PLANIFICADA; decidir semántica de enviado/promoción y recuperación                     |

Pricing migration ya aplicada. No está “pendiente de instalar”; sigue VALIDACIÓN PENDIENTE de release. P01 puede bloquear Maps real, pero no pruebas locales de P02/P03/P04: si ocurre, documentar la excepción y avanzar solo a la primera tarjeta independiente, nunca declarar Pricing listo.

### F3 — agenda, recuperación y resguardo de la operación

| ID  | Tarea                                                                   | Prioridad | Estado                                                             |
| --- | ----------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| R01 | Duración real, capacidad, márgenes y disponibilidad al comprometer      | P1        | DECISIÓN — contrato operativo, luego implementación                |
| R02 | Recuperación Calendar/correo/Maps y coste de llamadas                   | P1        | PLANIFICADA; sync confirmed existente se conserva                  |
| R03 | Límites de abuso/idempotencia pública, incluidos ingesta/récords        | P1        | PLANIFICADA; no alterar gameplay ni métricas semánticas            |
| R04 | Destinos de dinero actuales, privacidad mínima y restauración operativa | P1        | PLANIFICADA; borrado/prueba de pago real con autorización separada |

Gate G1: F1–F3 con pruebas de errores/concurrencia/aislamiento, QA autenticado y un recorrido real controlado autorizado. El roadmap puede mostrar implementación terminada y QA pendiente; no abrir F4 para ocultar un bloqueo crítico. Revisar con Terra Muy alto; Astra solo según checkpoints del plan.

### F4 — Rides/Admin de nivel profesional

| ID   | Tarea                                                                      | Prioridad   | Estado                                                 |
| ---- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| UX01 | Accesibilidad y claridad de reserva                                        | P1          | PLANIFICADA; diseño aprobado UX00                      |
| UX02 | Responsive Rides deliberado: mobile/tablet/desktop                         | P1 producto | PLANIFICADA; no cambiar Horizon al reordenar su enlace |
| UX03 | Admin/Pricing: operación diaria vs configuración, resumen de estado/precio | P1 producto | PLANIFICADA; QA autenticado obligatorio                |

### F5 — Passenger premium y Horizon fiable

| ID   | Tarea                                                                | Prioridad    | Estado                                                        |
| ---- | -------------------------------------------------------------------- | ------------ | ------------------------------------------------------------- |
| PA01 | Exactitud analytics por agregación/paginación                        | P1           | PLANIFICADA; preservar cutoff/engagements existentes          |
| PA02 | Pairing/ingesta confiable y recuperación para la tablet actual       | P1           | PLANIFICADA; sin plataforma de flotas ni re-pairing rutinario |
| UX04 | Music: acabado propio, estados y descubrimiento coherentes           | P1 producto  | PLANIFICADA; conservar fuente Spotify y personalidad STREEX   |
| UX05 | Passenger Home/idle/navegación/fallback y accesibilidad              | P1 producto  | PLANIFICADA; Clima se usa como referencia, no se rediseña     |
| H01  | Horizon: test harness, tiempo activo, score independiente de FPS     | P1 funcional | PLANIFICADA; decidir convivencia con récords legacy           |
| H02  | Horizon: ranking veraz, onboarding/HUD/resultados, responsive propio | P2           | PLANIFICADA; sin rehacer renderer ni duplicar pagos/contacto  |

Passenger sigue landscape-first. Tablet/desktop responsive de Rides no cambia esta decisión. H01/H02 no dependen de ampliar Around You a 100 POIs: la solicitud explícita de reevaluación de Horizon modifica aquella dependencia histórica.

### F6 — mejoras de valor demostrado, no obligatorias para cerrar fundamentos

| ID  | Tarea                                                                   | Prioridad | Estado                                                                  |
| --- | ----------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| O01 | Medición por ruta, rendimiento y extracciones incrementales             | P2        | PLANIFICADA; no refactor general sin evidencia                          |
| O02 | Cotización de marca/seguimiento/repetición para Juan                    | P2        | DECISIÓN — activar solo el primer caso útil, no CRM completo            |
| O03 | Driver MC mínimo para la operación actual                               | P2        | DECISIÓN — alcance Home/reset/estado, sin telemetría hardware prometida |
| H03 | Horizon: piloto de experiencias/oleadas reproducibles y variedad curada | P2        | DECISIÓN — vertical slice separado, después de H01/H02                  |

### F7 — revisión final

| ID  | Tarea                                                       | Prioridad | Estado                                               |
| --- | ----------------------------------------------------------- | --------- | ---------------------------------------------------- |
| V01 | Reauditoría final con Astra contra diagnóstico y evidencias | P1 cierre | PLANIFICADA; requisitos explícitos en EXECUTION_PLAN |

F6 puede diferirse explícitamente por el propietario y no bloquea V01. V01 no requiere ejecutar SaaS ni todo backlog futuro. Una tarea aprobada para este ciclo y aún sin verificar no se convierte en DONE por diferir otras.

## Backlog Passenger/producto preservado, sin activación automática

| ID  | Alcance conservado                                                                     | Estado / gate de reactivación                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B01 | visualTheme, migración liteTheme, Halloween; Original/Accent y fallback                | STANDBY de ejecución; tras UX04/UX05 y contrato visual aprobado. Estacionalidad no autoriza lanzamiento automático.                                                                        |
| B02 | Around You category-first/offline, editorial, catálogo hasta 100 verificados por lotes | STANDBY; priorizar calidad/QA de campo antes de cantidad; sin mapas/scraping/ubicación persistida.                                                                                         |
| B03 | Juegos Passenger adicionales                                                           | STANDBY; después de B02 estable; excepción Horizon H01–H03 explícita.                                                                                                                      |
| B04 | Complete/Kids, personalización temporal y Driver MC extendido                          | STANDBY; después de O03/PA02 y revisión de privacidad; no confundir modos, temas y sesión.                                                                                                 |
| B05 | Feedback voluntario y fin de viaje/QR contextual                                       | STANDBY; señal de conductor, no inferencia de partida por GPS.                                                                                                                             |
| B06 | Validación de tip/payout y reseñas live; checkout QR unificado ya existe               | STANDBY de ampliación/validación real; no rehacer los tres métodos publicados. Cualquier destinatario incorrecto actual se atiende en R04. Pago de prueba solo por propietario autorizado. |
| B07 | Fully Remote/test controls/publicación Lite/ensayo de backup en equipo de repuesto     | VALIDACIÓN PENDIENTE de evidencia específica; no repetir setup ni borrar la única tablet; rutina semanal y pairing documentados en HANDOFF.                                                |
| B08 | Imágenes finales por superficie y temporadas                                           | STANDBY hasta mapa de assets aprobado; no mezclar slots Rides/Passenger.                                                                                                                   |

Los contratos futuros están en PROJECT_CONTEXT; los gates/modelos/pruebas están en el plan único. Estos IDs no son una segunda cola activa.

## SaaS/comercialización — STANDBY explícito

| ID  | Alcance                                                                                    | Reactivación requerida                                                                     |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| C01 | Defaults comerciales neutrales, onboarding/publicación de drivers, múltiples instalaciones | Antes de incorporar otro operador; requiere S05/R04/PA02 y aprobación. No ejecutar ahora.  |
| C02 | Evaluación comercial/licencias de Spotify y oferta musical SaaS                            | Antes de monetizar/prometer Music a terceros; no posterga fallos personales actuales.      |
| C03 | Piloto asistido 3–5 conductores y voluntad de pago                                         | Solo decisión explícita de comercializar; después de C01 y criterios operativos cumplidos. |
| C04 | Suscripciones SaaS, planes/entitlements, billing y soporte autoservicio                    | Después de C03 validado; no confundir con cobro de viajes actuales.                        |
| C05 | Offboarding/exportación autoservicio, términos y operación multi-cliente                   | Antes de altas comerciales; seguridad/retención/backups actuales siguen en R04.            |

No habilitar nuevos drivers como “prueba” de una tarea visual. Tests de aislamiento se hacen con fixtures controlados; no equivalen a lanzamiento comercial.

## Trazabilidad completa de las 27 recomendaciones

| Auditoría | Ejecución vigente                                                     |
| --------- | --------------------------------------------------------------------- |
| Q1        | S03                                                                   |
| Q2        | D00 y actualización por checkpoint                                    |
| Q3        | P01                                                                   |
| Q4        | S06                                                                   |
| I1        | P02                                                                   |
| I2        | P06                                                                   |
| I3        | P03                                                                   |
| I4        | P04/P05                                                               |
| I5        | UX01                                                                  |
| I6        | UX00/UX02/UX03                                                        |
| I7        | PA01                                                                  |
| I8        | Tests obligatorios de cada tarjeta y gates G0/G1/V01                  |
| A1        | S01/S02                                                               |
| A2        | S04                                                                   |
| A3        | S05 — actual, NO standby                                              |
| A4        | P07/P08                                                               |
| A5        | R01                                                                   |
| A6        | R04 protección actual; C01 comercial                                  |
| A7        | R03/PA02 actual; C01 expansión multioperador                          |
| A8        | R02/P06; push Calendar completo diferido dentro de R02                |
| A9        | O01 y extracciones justificadas por tarjeta                           |
| A10       | R04 actual; C05 comercial                                             |
| A11       | C02; recuperación personal actual en PA02                             |
| O1        | C03                                                                   |
| O2        | O02; pagos ampliados B06                                              |
| O3        | UX04/UX05/O03/B04; Horizon H01–H03 es profundización nueva autorizada |
| O4        | C01/C04/C05                                                           |

No se borran hallazgos al cambiar prioridad. Si aparece evidencia nueva que afecte dinero/datos/seguridad actual, crear una tarjeta acotada y explicar el cambio de orden al propietario; no reactivar SaaS entero.

# STREEX — contexto técnico

Actualizado: 2026-09-06. Este documento describe contratos; no establece una cola de trabajo.
Prioridad/estado: [ROADMAP](ROADMAP.md). Reanudación: [HANDOFF](HANDOFF.md). Criterios: [EXECUTION_PLAN](EXECUTION_PLAN.md).
El contexto anterior, incluidos roadmaps Passenger, se conserva en [archivo](archive/2026-09-05/PROJECT_CONTEXT.md).

## Productos y propiedad

Rides es la app principal de Juan; Pricing/Admin cotiza y opera; Passenger es la experiencia bilingüe en vivo; Horizon sigue global y técnicamente aislado bajo runner. Comparten repositorio, no responsabilidades indistintas. Su planificación es única.

Producción: Vercel en https://rides.getstreex.com y Supabase standalone de Rides. La entrada pública https://getstreex.com/* se redirige en Cloudflare con 301 a la ruta equivalente en `https://rides.getstreex.com/$1`; no envía a Passenger. Lovable permanece como herramienta de trabajo/aprobación visual. Migraciones versionadas requieren autorización privilegiada; secretos nunca se documentan.

Arquitectura: React 19, TanStack Start/Router, TypeScript, Vite/Tailwind, Bun y FullCalendar. Preservar el monolito modular.

## Rides / Admin / datos

- Landing: src/routes/index.tsx y src/components/streex/. También existen /request-a-ride y páginas de servicio SLC Airport, Park City y Las Vegas.
- Reservas: BookingFormModal, booking.functions y availability.server/functions. Estados pending no bloquean; quoted/confirmed sí. Bloques manuales y triggers protegen solapamientos. Valores predeterminados: duración 60 min, slots 30 min, aviso 12 h, America/Denver; no asumir que describen todo trayecto real.
- Admin: AdminPanel, componentes admin/ y server functions. Auth valida usuario y memberships almacenadas en DB; jamás user_metadata ni un tenant id del navegador sin autorización. No hay emergency bypass de producción.
- Datos principales: bookings, reviews, runner_scores, app_settings, tenant_availability, blocked_slots, tenants, user_profiles, tenant_memberships, platform_admins, audit_log y conexiones/OAuth Calendar.
- Reseñas solo publican approved. Horizon modera nombres/récords. La discrepancia actual de rank vs approved se documenta en RUNNER_CONTEXT; no asumir que cada score equivale a un pasajero.
- Storage tenant-assets es público para imágenes y requiere rutas/permiso por tenant para writes. No retirar operaciones legítimas de Storage al endurecer tablas server-owned.
- SaaS está en standby; la divergencia detectada entre suspensión server-side y RLS continúa siendo trabajo de seguridad actual.

## Pricing — contrato aprobado y límites

Ubicación: /admin/pricing, src/features/pricing/, PricingPanel, pricing.functions, pricing-maps.server y pricing-lifecycle.server.

La migración 20260830015239_pricing_engine.sql está aplicada según la auditoría. No reaplicarla. `GOOGLE_MAPS_SERVER_KEY` está asignada en Vercel Production/Preview/Development, pero no se inspeccionó su valor ni se validó Geocoding server-side. La variable de navegador `VITE_GOOGLE_MAPS_BROWSER_KEY` está asignada en Production/Preview; una prueba real del formulario registró HTTP 403 `PERMISSION_DENIED` en `places.googleapis.com/.../AutocompletePlaces`. Falta aislar si se debe a API habilitada, restricciones de key/referrer/proyecto u otra autorización. No modificar claves o permisos a ciegas. Son credenciales distintas y una no sustituye a la otra.

Mantener:

- Motor puro con importes en centavos.
- Flat Rate por zona antes de Dynamic/Hourly.
- Positioning como componente interno, con zona/radio incluido conforme al contrato aprobado.
- Cotización manual y ligada a reserva usando el mismo motor/snapshot; precio final/override explícito.
- Snapshots de ruta, settings, reglas, recomendación, precio final, descuentos y comisión: cambios posteriores de perfil no deben reescribirlos.
- Promoción se consume al enviar, no al previsualizar; referral pasa a payable al completar viaje, no al cotizar.

Son reglas objetivo, no afirmaciones de que todos los caminos ya las cumplen. Permanecen abiertos payload vinculado, timezone, preview viejo, Hourly sin destino, stops/zonas, transiciones, fallo parcial y recuperación. Solo el plan fija sus tareas. No prometer pricing automático de producción hasta superar sus gates.

Las tablas pricing_profiles, pricing_zones, pricing_flat_rates, pricing_promotions, referral_partners, pricing_quotes y pricing_promo_redemptions son tenant-scoped, con RLS y acceso server-side privilegiado, no browser grants amplios.

## Calendar / correo / pagos

- [Calendar](GOOGLE_CALENDAR.md): OAuth, free-busy, sync de confirmed, estado/retry existentes. STREEX manda en el estado de reserva; no cancelar un booking porque alguien movió/borró un evento Google.
- Resend envía correo transaccional y procesa /api/resend/inbound con firma Svix. Variables RESEND_API_KEY, RESEND_WEBHOOK_SECRET, INBOUND_FORWARD_TO y remitente de dominio verificado: nunca publicar valores privados.
- Firma de webhook no sustituye deduplicación. Persistencia local y envío externo requieren recuperación; no declarar delivered solo porque se guardó un snapshot.
- Pagos actuales son enlaces alojados/QR, no un ledger completo de cobros. Diferenciar cotización, aceptación, pago y payout. Revisar destinos de Juan ahora; neutralización comercial de defaults antes de activar otro driver, en standby.

## Passenger — baseline que se conserva

/passenger es landscape-first, EN/ES, tablet Galaxy Tab A9+ con Fully Kiosk. Rides responsive en tablet NO reabre automáticamente Passenger portrait.

- Lite actual: Home, Music, Games, STREEX. Around You accesible desde Home, no primer nivel de nav Lite.
- Music Reload existe: arte de álbum, ambient glow y stage lights; no es “acabado final”. Spotify es fuente de reproducción/metadata, UI propia de STREEX. No convertirla en clon de Spotify.
- Clima Premium existe y es la referencia de calidad del propietario: jerarquía actual/horas/días, atmósferas semánticas compartidas entre detalle/Home/idle y fallbacks. Su fuente NWS/cache/GPS no debe alterarse para copiar efectos visuales.
- RELOAD 1.0 conserva su jerarquía histórica: 1.1 modos Lite/Complete; 1.2 idle Music-first/rail; 1.3 Launch Visual Theme dentro de RELOAD y antes de Point 0; 1.4 test controls; 1.5 publicación/validación Lite. No reconstruir una cola antigua a partir de esos nombres. El estado vigente de cada parte está en ROADMAP/HANDOFF.
- Idle público: 90 s; rail: 30 s, clima horas/días, juego rotativo, QR y llamadas STREEX. Music es el hero publicado; Around You idle sigue diferido. Idle/resume no debe perder pairing ni confundir page load con engagement.
- Launch theme actual: Original/Accent vía liteTheme, Accent por defecto. No crear un tercer sistema de temas incidentalmente.
- Test tool no enlazado ?passenger-test=1: logical rest/overrides de atmósfera, 15 s idle/10 s rail solo allí. No es autenticación robusta ni control físico de Android; no publicar secretos ni ampliar esa interfaz como Driver MC.
- PWA/manifest/SW separados de Admin; cache de assets estáticos y recuperación offline. Kiosk/power/brightness de hardware pertenecen a Android/Fully o puente explícitamente soportado.
- Contacto/tips se continúan en teléfono por QR. BookingFormModal/FeedbackForm se reutilizan; cambiar esos compartidos exige regresión Passenger sin alterar su diseño accidentalmente.
- Los métodos QR ya publicados son Venmo, Cash App y una opción conjunta Apple Pay/Google Pay/Card mediante Stripe-hosted checkout. B06 conserva esta unificación y deja por separado la evidencia de cobro/payout real; no autoriza reconstruirla.
- Juegos locales Utah Trivia, Higher or Lower y This or That son bilingües/offline; no agregan backend ni identidad. Horizon hoy es teaser/QR en tablet, juego /runner-lab en teléfono. Cambiar ese contrato requiere aprobación.

### Ubicación, clima y Spotify

[Around You](AROUND_YOU.md) usa catálogo local y posición transitoria. Muestreo de bajo consumo solo en Home/Around You, no Music/Games/STREEX/idle. No persistir coordenadas, enviarlas a analytics ni añadirlas a URLs. Clima reutiliza un área redondeada (~1 km) para NWS; eso no equivale a transmitir historial GPS crudo. Cache NWS y último snapshot permiten estados stale/offline. EN usa Fahrenheit; ES Celsius.

Spotify personal/driver-mediated usa refresh token cifrado en tabla privada y sesión HTTP-only firmada tras pairing; el navegador recibe metadata saneada, no credenciales ni identidad de cuenta/dispositivo. Setup /spotify/setup. La revisión de comercialización está en standby: fallos reales de sesión, revocación, privacidad o reproducción del uso actual no lo están.

### Analytics

GA: producción Rides, excluye /admin, /passenger, /runner-lab, /spotify. La falta de exclusión de enlaces sensibles/query strings es el pendiente S01, no una garantía completada.

Passenger: tablas privadas sessions/events/engagements, acciones semánticas allowlisted. Page load = sesión técnica; interacción real/idle exit = engagement anónimo. Un engagement NO demuestra un viaje real; tablet_unverified es el estado actual. Mantener cutoff Start beta measurement sin borrar datos ni volver a iniciarlo por rutina.

Instalación opaca aleatoria y colas acotadas de 24 h; no pasajero, dirección, GPS, user agent, raw device id o coordenadas táctiles. Resumen Admin valida membership. Exactitud de agregación y autenticidad de ingesta tienen tareas actuales; no cambiar la semántica para sortearlas.

### Contratos futuros preservados, sin autorización de implementación

La activación y orden están solo en ROADMAP (B01/B04):

- experienceMode: lite, futuro complete, futuro kids. Quiet/Guest/Test son controles de sesión, no modos.
- Personalización temporal solo tras señal confiable Driver MC; contexto rico de reserva limitado a Complete; nada automático en Kids ni por inferencia GPS.
- visualTheme independiente del modo: Original, Accent y piloto Halloween. Migrará liteTheme, no coexistirá como sistema duplicado.
- Temas solo tokens/imaginería/copy/motion; jamás navegación, flags, APIs, GPS, booking, pagos o lógica Music/Games/Around You.
- Validación integral; unknown/incomplete/expired → Original. Imágenes fallan al fondo del mismo tema. Manual Admin precede horario America/Denver.
- Contraste AA, reduced motion, sin strobe; Kids solo temas kidsSafe (inicialmente Original/Accent). Pruebas de completitud, fallback, precedence, expiry y restricciones antes de implementar.

## Disciplina de verificación

No confundir código, prueba automática, navegador autenticado, producción y tablet física. Evidencia actual y próxima acción están en HANDOFF. No reconstruir una auditoría completa para cada tarea; abrir solo el contrato y los archivos implicados.

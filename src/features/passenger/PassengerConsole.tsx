import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "@/config";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  CalendarPlus,
  ChevronRight,
  Clock3,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  CreditCard,
  Compass,
  Gamepad2,
  Globe2,
  Heart,
  HandCoins,
  Languages,
  Mail,
  Menu,
  MessageCircle,
  MoonStar,
  Music2,
  Flag,
  MapPin,
  Pause,
  Phone,
  Play,
  QrCode,
  RefreshCw,
  Search,
  SkipForward,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Snowflake,
  Wifi,
  Wind,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ServiceTicker } from "@/components/streex/ServiceTicker";
import { BookingFormModal } from "@/components/streex/BookingFormModal";
import { FeedbackForm } from "@/components/streex/FeedbackForm";
import { ExperienceGallery } from "@/components/streex/ExperienceGallery";
import { ServiceAreas } from "@/components/streex/ServiceAreas";
import { ServicesSection } from "@/components/streex/ServicesSection";
import { QRCodeSVG } from "qrcode.react";
import {
  controlPersonalSpotifyPlayback,
  getPersonalSpotifyPlayback,
  getPersonalSpotifyPlaylistArtwork,
  playPersonalSpotifyTrack,
  searchPersonalSpotifyTracks,
  setPersonalSpotifyRepeatMode,
} from "@/lib/spotify.functions";
import { listPublicReviews } from "@/lib/review.functions";
import type { PassengerWeatherCondition, PassengerWeatherSnapshot } from "@/lib/weather";
import {
  useClock,
  useOnlineStatus,
  usePassengerIdleReset,
  usePassengerWeather,
  type PassengerWeatherStatus,
} from "./usePassengerState";
import { UtahTrivia } from "./UtahTrivia";
import { ThisOrThat } from "./ThisOrThat";
import { UtahHigherOrLower } from "./UtahHigherOrLower";
import { HoneycombMark } from "./game-marks";
import { THIS_OR_THAT_TRAILER_VISUALS } from "./this-or-that-visuals";
import { AroundYouHomeCard } from "./around-you/AroundYouHomeCard";
import { AroundYouView } from "./around-you/AroundYouView";
import { AROUND_YOU_SEED_PLACES } from "./around-you/around-you-data";
import {
  createAroundYouSimulatedPosition,
  getAroundYouTestPresets,
} from "./around-you/around-you-test-mode";
import type { AroundYouLanguage } from "./around-you/around-you-types";
import { useAroundYouEngine } from "./around-you/useAroundYouEngine";
import { usePassengerLocation } from "./around-you/usePassengerLocation";
import { usePassengerAnalytics } from "./usePassengerAnalytics";
import {
  createSpotifyPostControlRefreshScheduler,
  createSingleFlight,
  shouldPollSpotifyHome,
  startSpotifyPolling,
} from "./spotify-playback-request";
import {
  createPassengerRepeatSession,
  createPassengerRepeatRetryGate,
  decidePassengerRepeatAction,
  isSamePassengerRepeatSession,
  readPassengerRepeatSession,
  writePassengerRepeatSession,
} from "./spotify-passenger-repeat";
import { WeatherAtmosphere, type AtmosphereVariant } from "./WeatherAtmosphere";
import type { PassengerAnalyticsScreen } from "@/lib/passenger-analytics";
import utahTriviaAtlas from "@/assets/passenger-games/utah-trivia-atlas.jpg";
import utahTriviaNationalParks from "@/assets/passenger-games/utah-trivia-national-parks.jpg";
import utahTriviaSymbols from "@/assets/passenger-games/utah-trivia-symbols.jpg";
import passengerHomeAirport from "@/assets/streex-gallery/passenger-home-airport.webp";
import passengerRav4Front from "@/assets/streex-gallery/passenger-rav4-front.jpg";
import passengerRav4Rear from "@/assets/streex-gallery/passenger-rav4-rear-winter.webp";
import passengerRav4Snow from "@/assets/streex-gallery/passenger-rav4-deer-valley.webp";
import passengerRav4Side from "@/assets/streex-gallery/passenger-rav4-capitol.webp";
import horizonQuickActionCard from "@/features/runner/assets/quick-action/horizon_quick_action_card.webp";

type Language = AroundYouLanguage;

const WEATHER_ATMOSPHERE_OPTIONS: { id: AtmosphereVariant; label: string }[] = [
  { id: "thunderstorms", label: "Storm" },
  { id: "rain", label: "Rain" },
  { id: "snow", label: "Snow" },
  { id: "fog", label: "Fog" },
  { id: "smoke", label: "Smoke" },
  { id: "partly-cloudy-night", label: "Night" },
  { id: "cloudy", label: "Clouds" },
  { id: "clear", label: "Clear" },
];

function atmosphereForWeather(
  condition: PassengerWeatherCondition,
  night: boolean,
): AtmosphereVariant {
  if (condition === "thunderstorms") return "thunderstorms";
  if (condition === "rain") return "rain";
  if (condition === "snow") return "snow";
  if (condition === "fog") return "fog";
  if (condition === "smoke") return "smoke";
  if (
    night &&
    (condition === "clear" || condition === "mostly-clear" || condition === "partly-cloudy")
  ) {
    return "partly-cloudy-night";
  }
  if (condition === "cloudy" || condition === "wind") return "cloudy";
  return "clear";
}

type View =
  | "home"
  | "music"
  | "around-you"
  | "games"
  | "streex"
  | "meet-juan"
  | "services"
  | "contact"
  | "reviews"
  | "tip"
  | "where-we-ride";

type PassengerGame = "trivia" | "choice" | "higher-lower";

type PassengerReview = {
  name: string;
  location: string | null;
  stars: number;
  text: string;
};

function passengerAnalyticsScreen(view: View): PassengerAnalyticsScreen {
  return view === "meet-juan"
    ? "meet_juan"
    : view === "where-we-ride"
      ? "where_we_ride"
      : view === "around-you"
        ? "around_you"
        : view;
}

const PASSENGER_REVIEW_ROTATION_MS = 30_000;

const PASSENGER_GAMES: readonly PassengerGame[] = ["trivia", "choice", "higher-lower"];

type PassengerConsoleProps = {
  config: AppConfig;
};

const MUSIC_LIBRARY = [
  { title: "Midnight Drive", artist: "The Wayfarers", album: "Neon Roads", duration: "3:42" },
  { title: "Canyon Light", artist: "Sable & Sun", album: "Utah Skies", duration: "4:11" },
  { title: "Golden Hour", artist: "Rivera", album: "West Coast Nights", duration: "3:58" },
  { title: "Quiet Passenger", artist: "Marlow", album: "Backseat Tapes", duration: "2:47" },
];

const MUSIC_VIBES = [
  { query: "chill", labelKey: "vibeChill", accent: "#4FB3FF", icon: Wind },
  { query: "throwbacks", labelKey: "vibeThrowbacks", accent: "#FF8C42", icon: Clock3 },
  { query: "latin", labelKey: "vibeLatin", accent: "#FF4D6D", icon: Music2 },
  { query: "pop", labelKey: "vibePop", accent: "#C77DFF", icon: Star },
  { query: "r&b", labelKey: "vibeRnB", accent: "#7B2D8B", icon: Heart },
  { query: "spotify top 50 usa", labelKey: "vibeTopUs", accent: "#E6CE20", icon: Flag },
  { query: "spotify top 50 global", labelKey: "vibeTopGlobal", accent: "#7ED957", icon: Globe2 },
  { query: "today's top hits", labelKey: "vibeToday", accent: "#FF6B6B", icon: TrendingUp },
] as const;

const copy = {
  en: {
    home: "Home",
    music: "Music",
    games: "Games",
    aroundYou: "Around You",
    streex: "Streex",
    privateRide: "Private ride",
    streexDifference: "The Streex difference",
    welcome: "Welcome to your ride",
    subtitle: "A private ride, with a little more built in.",
    exploreCue: "Tap to explore your ride",
    hostedBy: "Hosted by",
    hostCardEyebrow: "Your Streex host",
    hostCardDescription: "A local, bilingual ride with a little more built in.",
    localTime: "Local time",
    newYork: "New York",
    dallas: "Dallas",
    losAngeles: "Los Angeles",
    weather: "Weather",
    weatherHint: "Tap for the forecast",
    weatherDetailTitle: "Weather forecast",
    weatherDetailDescription: "Live conditions and a short outlook for",
    weatherNow: "Right now",
    nextHours: "Next few hours",
    nextDays: "Next 4 days",
    precipitation: "Precipitation",
    wind: "Wind",
    updated: "Updated",
    weatherUnavailable: "Live weather unavailable",
    weatherUnavailableDescription: "The last forecast will return when the connection is restored.",
    conditionClear: "Clear",
    conditionMostlyClear: "Mostly clear",
    conditionPartlyCloudy: "Partly cloudy",
    conditionCloudy: "Cloudy",
    conditionRain: "Rain",
    conditionThunderstorms: "Thunderstorms",
    conditionSnow: "Snow",
    conditionFog: "Fog",
    conditionSmoke: "Smoke",
    conditionWind: "Windy",
    conditionUnknown: "Current conditions",
    clearSkies: "Clear skies",
    partlyCloudy: "Partly cloudy",
    nowPlaying: "Now playing",
    chooseMusic: "Choose music",
    musicHint: "Tap to search songs and artists.",
    quickAccess: "Quick access",
    musicDescription: "Curated sound for your ride",
    gamesDescription: "Utah trivia & light games",
    streexDescription: "Book, tip, review & more",
    open: "Open",
    online: "Online",
    offline: "Offline",
    preview: "Simulated preview — no live music provider",
    spotifyPersonal: "Personal Spotify connection",
    musicEyebrow: "Your soundtrack",
    musicGettingReady: "Music is getting ready",
    musicGettingReadyDescription: "Start Spotify on the vehicle audio, then tap Refresh.",
    musicUnavailableTitle: "Music is unavailable right now",
    musicUnavailableDescription: "Please ask your driver to get the vehicle audio ready.",
    spotifyDisabled: "The personal Spotify connection is not enabled.",
    spotifyDriverSetup:
      "Your driver can finish the private Spotify setup before controls become available.",
    spotifyNotConnected: "Your driver has not connected Spotify yet.",
    spotifyNoDevice: "Start Spotify on the vehicle audio, then return here to choose music.",
    spotifyNoTrackTitle: "Nothing is playing yet",
    spotifyNoTrackDescription: "Pick a vibe or search for a song to set the soundtrack.",
    spotifyDevice: "Vehicle audio",
    spotifyActive: "Active",
    spotifyPlaying: "Playing",
    spotifyPaused: "Paused",
    spotifyRefresh: "Refresh",
    spotifyControlError: "Spotify could not update playback. Please try again.",
    searchSpotify: "Search Spotify",
    searchSpotifyHint: "Find a song to play on the active vehicle audio device.",
    musicDiscoveryTitle: "Choose what plays next",
    musicDiscoveryDescription: "Search for a song or start with one of the collections above.",
    searchButton: "Search",
    searchResults: "Song results",
    searchEmpty: "No songs found. Try another search.",
    searchMinLength: "Enter at least two characters to search Spotify.",
    playSong: "Play song",
    explicit: "Explicit",
    musicTitle: "Music",
    musicSubtitle: "Search songs and shape the soundtrack for your ride.",
    pickVibe: "Pick a vibe",
    exploreMusic: "Explore music",
    vibeChill: "Chill",
    vibeThrowbacks: "Throwbacks",
    vibeLatin: "Latin",
    vibePop: "Pop",
    vibeRnB: "R&B",
    vibeTopUs: "Top 50 U.S.",
    vibeTopGlobal: "Top 50 Global",
    vibeToday: "Today's Top Hits",
    search: "Search songs, artists, moods…",
    results: "Results",
    gamesTitle: "Games",
    gamesSubtitle: "Light entertainment for the road.",
    gamesEyebrow: "Take a break",
    comingSoon: "Coming soon",
    playNow: "Play now",
    utahTrivia: "Utah Trivia",
    utahTriviaDescription: "Test what you know about the Beehive State.",
    triviaPreview: "Utah edition",
    thisOrThat: "This or That",
    thisOrThatDescription: "Quick, playful choices between two options.",
    choicePreview: "Pick a side",
    choiceFirst: "THIS",
    choiceSecond: "THAT",
    utahHigherOrLower: "Utah: Higher or Lower",
    utahHigherOrLowerDescription: "Pick which Utah fact comes out on top.",
    higherOrLowerPreview: "UTAH COMPARISONS",
    horizonTitle: "Streex Horizon",
    horizonTabletDescription: "Coming soon to your tablet experience.",
    horizonPhoneTitle: "Play Streex Horizon on your phone",
    horizonPhoneDescription: "Scan to continue on your phone.",
    streexTitle: "Private rides. Elevated.",
    streexSubtitle: "Designed around you.",
    streexExperienceTitle: "The Streex Experience",
    yourRideGallery: "Your Streex ride",
    whereWeRide: "Where We Ride",
    whereWeRideTitle: "Utah roots. Longer horizons.",
    whereWeRideDescription:
      "Private transportation throughout Northern Utah, Park City and beyond — with every route planned around your schedule.",
    serviceArea: "Service Area",
    moreDestinations: "More Destinations",
    extendedRides: "Extended Rides",
    bookRide: "Book another ride",
    services: "Services",
    contact: "Contact",
    reviews: "Reviews",
    tip: "Leave a tip",
    continuePhone: "Continue on your phone",
    continuePhoneDescription: "Scan to continue your Streex experience on your phone.",
    idlePhoneScan: "Scan to connect",
    idleWeatherTitle: "Salt Lake City weather",
    idleWeatherHours: "Next few hours",
    idleWeatherDays: "Next 4 days",
    idleGameEyebrow: "Take a quick break",
    idleBookingEyebrow: "Keep Streex with you",
    idleBookingDescription: "Scan to schedule your next private ride from your phone.",
    idleStreexEyebrow: "Your ride, your way",
    idleStreexTitle: "Explore Streex",
    idleStreexDescription: "Plan a future ride, see services, leave a tip or share feedback.",
    idleStreexAction: "Open Streex",
    meetJuan: "Meet Juan",
    guestNotesEyebrow: "Streex guest notes",
    guestNotesTitle: "A few words from the road",
    noApprovedReviews: "No approved reviews available yet.",
    reviewAuthorFallback: "Streex passenger",
    unavailable: "Coming soon",
    meetIntro: "Hi, I’m Juan.",
    gratitude:
      "If your ride felt right, a review or a tip is always appreciated — only if you feel like it.",
    leaveReview: "Leave a review",
    leaveTip: "Leave a tip",
    back: "Back to Streex",
    bilingual: "English + Español",
    hospitality: "Hospitality first",
    qrNote: "The phone continuation link will appear here when configured.",
    servicesTitle: "Services for every kind of ride.",
    contactTitle: "Contact Streex",
    contactSubtitle: "Contact details to use from your own phone.",
    contactNote: "This tablet does not place calls or send messages.",
    contactSaveTitle: "Save Juan's contact",
    contactSaveDescription: "Scan this separate QR to add Juan directly to your phone.",
    contactSaveDownload: "Download contact card",
    phoneAndText: "Call or text",
    whatsapp: "WhatsApp",
    email: "Email",
    website: "Website",
    reviewTitle: "Share your experience",
    reviewSubtitle: "Your feedback helps us make every ride better.",
    tipTitle: "Thank you for riding with Streex",
    tipSubtitle: "Optional ways to show your appreciation.",
    tipOptionsTitle: "Choose a convenient option",
    tipOptionsNote: "Only if you wish — thank you for riding with Streex.",
    tipInstruction: "Choose a method, then scan the QR with your phone.",
    tipScan: "Scan to continue on your phone",
    tipSecure: "Your payment is completed securely on your own device.",
    venmo: "Venmo",
    cashApp: "Cash App",
    cardAndWallet: "Apple Pay, Google Pay & Card",
    stripeDetail: "Choose your preferred option in the secure checkout",
    stripePending: "Stripe setup pending",
    idleTitle: "Ready for your Streex experience?",
    idleDescription: "Your music, games and Streex experience are one tap away.",
    idleAction: "Tap anywhere to explore",
    idleNowPlaying: "Now playing on Streex",
    idleMusicReady: "Your Streex soundtrack",
    idleMusicPrompt: "Your soundtrack starts here",
    idleChooseMusic: "Choose the soundtrack for your ride",
    idleChooseMusicDescription: "Search songs, explore Top 50, or pick a vibe for the road.",
    idleMusicSearch: "Search songs",
    idleMusicTop: "Top 50",
    idleMusicVibes: "Pick a vibe",
    idleHost: "Your Streex host",
  },
  es: {
    home: "Inicio",
    music: "Música",
    games: "Juegos",
    aroundYou: "A tu alrededor",
    streex: "Streex",
    privateRide: "Viaje privado",
    streexDifference: "La diferencia Streex",
    welcome: "Bienvenido a tu viaje",
    subtitle: "Un viaje privado, con algo más para disfrutar.",
    exploreCue: "Toca para explorar tu viaje",
    hostedBy: "Atendido por",
    hostCardEyebrow: "Tu anfitrión Streex",
    hostCardDescription: "Un viaje local y bilingüe, con algo más para disfrutar.",
    localTime: "Hora local",
    newYork: "Nueva York",
    dallas: "Dallas",
    losAngeles: "Los Ángeles",
    weather: "Clima",
    weatherHint: "Toca para ver el pronóstico",
    weatherDetailTitle: "Pronóstico del clima",
    weatherDetailDescription: "Condiciones en vivo y un vistazo rápido para",
    weatherNow: "Ahora",
    nextHours: "Próximas horas",
    nextDays: "Próximos 4 días",
    precipitation: "Precipitación",
    wind: "Viento",
    updated: "Actualizado",
    weatherUnavailable: "Clima en vivo no disponible",
    weatherUnavailableDescription:
      "El último pronóstico volverá cuando se restablezca la conexión.",
    conditionClear: "Despejado",
    conditionMostlyClear: "Mayormente despejado",
    conditionPartlyCloudy: "Parcialmente nublado",
    conditionCloudy: "Nublado",
    conditionRain: "Lluvia",
    conditionThunderstorms: "Tormentas eléctricas",
    conditionSnow: "Nieve",
    conditionFog: "Niebla",
    conditionSmoke: "Humo",
    conditionWind: "Ventoso",
    conditionUnknown: "Condiciones actuales",
    clearSkies: "Cielo despejado",
    partlyCloudy: "Parcialmente nublado",
    nowPlaying: "Reproduciendo",
    chooseMusic: "Elige la música",
    musicHint: "Toca para buscar canciones y artistas.",
    quickAccess: "Accesos rápidos",
    musicDescription: "Sonido seleccionado para su viaje",
    gamesDescription: "Trivia de Utah y juegos ligeros",
    streexDescription: "Reservar, propina, reseñas y más",
    open: "Abrir",
    online: "En línea",
    offline: "Sin conexión",
    preview: "Vista simulada — sin proveedor de música en vivo",
    spotifyPersonal: "Conexión personal de Spotify",
    musicEyebrow: "Tu banda sonora",
    musicGettingReady: "La música se está preparando",
    musicGettingReadyDescription:
      "Inicia Spotify en el audio del vehículo y luego toca Actualizar.",
    musicUnavailableTitle: "La música no está disponible en este momento",
    musicUnavailableDescription: "Consulta a tu conductor para preparar el audio del vehículo.",
    spotifyDisabled: "La conexión personal de Spotify no está habilitada.",
    spotifyDriverSetup:
      "Tu conductor puede terminar la configuración privada de Spotify antes de que los controles estén disponibles.",
    spotifyNotConnected: "Tu conductor todavía no ha conectado Spotify.",
    spotifyNoDevice: "Inicia Spotify en el audio del vehículo y vuelve aquí para elegir música.",
    spotifyNoTrackTitle: "Aún no hay música sonando",
    spotifyNoTrackDescription: "Elige un ambiente o busca una canción para crear la banda sonora.",
    spotifyDevice: "Audio del vehículo",
    spotifyActive: "Activo",
    spotifyPlaying: "Reproduciendo",
    spotifyPaused: "En pausa",
    spotifyRefresh: "Actualizar",
    spotifyControlError: "Spotify no pudo actualizar la reproducción. Inténtalo de nuevo.",
    searchSpotify: "Buscar en Spotify",
    searchSpotifyHint:
      "Encuentra una canción para reproducir en el dispositivo de audio activo del vehículo.",
    musicDiscoveryTitle: "Elige qué sonará después",
    musicDiscoveryDescription: "Busca una canción o comienza con una de las colecciones de arriba.",
    searchButton: "Buscar",
    searchResults: "Resultados de canciones",
    searchEmpty: "No se encontraron canciones. Prueba otra búsqueda.",
    searchMinLength: "Escribe al menos dos caracteres para buscar en Spotify.",
    playSong: "Reproducir canción",
    explicit: "Explícito",
    musicTitle: "Música",
    musicSubtitle: "Busca canciones y crea la banda sonora de tu viaje.",
    pickVibe: "Elige un ambiente",
    exploreMusic: "Explora música",
    vibeChill: "Chill",
    vibeThrowbacks: "Clásicos",
    vibeLatin: "Latino",
    vibePop: "Pop",
    vibeRnB: "R&B",
    vibeTopUs: "Top 50 EE. UU.",
    vibeTopGlobal: "Top 50 Global",
    vibeToday: "Éxitos de hoy",
    search: "Buscar canciones, artistas o moods…",
    results: "Resultados",
    gamesTitle: "Juegos",
    gamesSubtitle: "Entretenimiento ligero para el camino.",
    gamesEyebrow: "Tómate un descanso",
    comingSoon: "Próximamente",
    playNow: "Jugar ahora",
    utahTrivia: "Utah Trivia",
    utahTriviaDescription: "Ponga a prueba lo que sabe del Beehive State.",
    triviaPreview: "Edición Utah",
    thisOrThat: "This or That",
    thisOrThatDescription: "Elecciones rápidas y divertidas entre dos opciones.",
    choicePreview: "Elige un lado",
    choiceFirst: "ESTO",
    choiceSecond: "AQUELLO",
    utahHigherOrLower: "Utah: Higher or Lower",
    utahHigherOrLowerDescription: "Elige qué dato de Utah queda por encima.",
    higherOrLowerPreview: "COMPARACIONES DE UTAH",
    horizonTitle: "Streex Horizon",
    horizonTabletDescription: "Próximamente en tu experiencia de tablet.",
    horizonPhoneTitle: "Juega Streex Horizon en tu teléfono",
    horizonPhoneDescription: "Escanea para continuar en tu teléfono.",
    streexTitle: "Viajes privados. Elevados.",
    streexSubtitle: "Diseñado para ti.",
    streexExperienceTitle: "La experiencia Streex",
    yourRideGallery: "Tu viaje Streex",
    whereWeRide: "Dónde viajamos",
    whereWeRideTitle: "Raíces en Utah. Horizontes más amplios.",
    whereWeRideDescription:
      "Transporte privado en el norte de Utah, Park City y más allá, con cada ruta planificada según su horario.",
    serviceArea: "Área de servicio",
    moreDestinations: "Más destinos",
    extendedRides: "Viajes extendidos",
    bookRide: "Reservar otro viaje",
    services: "Servicios",
    contact: "Contacto",
    reviews: "Reseñas",
    tip: "Dejar propina",
    continuePhone: "Continuar en su teléfono",
    continuePhoneDescription: "Escanee para continuar su experiencia Streex en su teléfono.",
    idlePhoneScan: "Escanea para conectar",
    idleWeatherTitle: "Clima en Salt Lake City",
    idleWeatherHours: "Próximas horas",
    idleWeatherDays: "Próximos 4 días",
    idleGameEyebrow: "Tómese un descanso",
    idleBookingEyebrow: "Lleve Streex con usted",
    idleBookingDescription: "Escanee para reservar su próximo viaje privado desde su teléfono.",
    idleStreexEyebrow: "Tu viaje, a tu manera",
    idleStreexTitle: "Explora Streex",
    idleStreexDescription:
      "Planea un viaje, conoce los servicios, deja propina o comparte tu opinión.",
    idleStreexAction: "Abrir Streex",
    meetJuan: "Conoce a Juan",
    guestNotesEyebrow: "Notas de huéspedes Streex",
    guestNotesTitle: "Algunas palabras del camino",
    noApprovedReviews: "Todavía no hay reseñas aprobadas disponibles.",
    reviewAuthorFallback: "Pasajero Streex",
    unavailable: "Próximamente",
    meetIntro: "Hola, soy Juan.",
    gratitude:
      "Si su viaje se sintió bien, una reseña o propina siempre se agradece — solo si lo desea.",
    leaveReview: "Dejar una reseña",
    leaveTip: "Dejar una propina",
    back: "Volver a Streex",
    bilingual: "Inglés + Español",
    hospitality: "Hospitalidad primero",
    qrNote: "El enlace para continuar en su teléfono aparecerá aquí cuando se configure.",
    servicesTitle: "Servicios para cada tipo de viaje.",
    contactTitle: "Contactar a Streex",
    contactSubtitle: "Datos de contacto para usar desde su propio teléfono.",
    contactNote: "Esta tablet no realiza llamadas ni envía mensajes.",
    contactSaveTitle: "Guardar contacto de Juan",
    contactSaveDescription:
      "Escanee este QR independiente para agregar a Juan directamente a su teléfono.",
    contactSaveDownload: "Descargar tarjeta de contacto",
    phoneAndText: "Llamar o enviar mensaje",
    whatsapp: "WhatsApp",
    email: "Email",
    website: "Sitio web",
    reviewTitle: "Comparta su experiencia",
    reviewSubtitle: "Sus comentarios nos ayudan a mejorar cada viaje.",
    tipTitle: "Gracias por viajar con Streex",
    tipSubtitle: "Formas opcionales de mostrar su agradecimiento.",
    tipOptionsTitle: "Elija la opción más conveniente",
    tipOptionsNote: "Solo si lo desea — gracias por viajar con Streex.",
    tipInstruction: "Elija un método y escanee el QR con su teléfono.",
    tipScan: "Escanee para continuar en su teléfono",
    tipSecure: "El pago se completa de forma segura en su propio dispositivo.",
    venmo: "Venmo",
    cashApp: "Cash App",
    cardAndWallet: "Apple Pay, Google Pay y tarjeta",
    stripeDetail: "Elija su opción preferida en el pago seguro",
    stripePending: "Configuración de Stripe pendiente",
    idleTitle: "¿Listo para tu experiencia Streex?",
    idleDescription: "Tu música, juegos y experiencia Streex están a un toque.",
    idleAction: "Toca cualquier lugar para explorar",
    idleNowPlaying: "Reproduciendo en Streex",
    idleMusicReady: "Tu banda sonora Streex",
    idleMusicPrompt: "Tu banda sonora empieza aquí",
    idleChooseMusic: "Elige la música para tu viaje",
    idleChooseMusicDescription:
      "Busca canciones, explora el Top 50 o elige un estilo para el viaje.",
    idleMusicSearch: "Buscar canciones",
    idleMusicTop: "Top 50",
    idleMusicVibes: "Elige un estilo",
    idleHost: "Tu anfitrión Streex",
  },
} as const;

export function PassengerConsole({ config }: PassengerConsoleProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [view, setView] = useState<View>("home");
  const [requestedGame, setRequestedGame] = useState<PassengerGame | null>(null);
  const [quickGameIndex, setQuickGameIndex] = useState(0);

  const consumeRequestedGame = useCallback(() => {
    setRequestedGame(null);
  }, []);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [aroundYouTestMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("around-you-test") === "1",
  );
  const [passengerTestMode] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("passenger-test") === "1",
  );
  const [weatherAtmosphereTestOverride, setWeatherAtmosphereTestOverride] =
    useState<AtmosphereVariant | null>(null);
  const [simulatedAroundYouPlaceId, setSimulatedAroundYouPlaceId] = useState<string | null>(null);
  const t = copy[language];
  const online = useOnlineStatus();
  const [approvedReviews, setApprovedReviews] = useState<PassengerReview[]>([]);
  const [reviewOffset, setReviewOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listPublicReviews({ data: {} })
      .then(({ reviews }) => {
        if (cancelled) return;
        setApprovedReviews(
          reviews.map((review) => ({
            name: review.name?.trim() || copy.en.reviewAuthorFallback,
            location: review.location,
            stars: review.rating,
            text: review.message,
          })),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[PassengerConsole] approved reviews read error", error);
          setApprovedReviews([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setReviewOffset(0);
    if (approvedReviews.length <= 3) return;
    const rotation = window.setInterval(() => {
      setReviewOffset((current) => (current + 3) % approvedReviews.length);
    }, PASSENGER_REVIEW_ROTATION_MS);
    return () => window.clearInterval(rotation);
  }, [approvedReviews.length]);

  const visibleReviews = useMemo(() => {
    if (approvedReviews.length <= 3) return approvedReviews;
    return Array.from({ length: 3 }, (_, index) => {
      return approvedReviews[(reviewOffset + index) % approvedReviews.length];
    });
  }, [approvedReviews, reviewOffset]);

  const consoleConfig = config.passengerConsole;
  const isLiteExperience = consoleConfig.experienceMode === "lite";
  const analytics = usePassengerAnalytics(passengerAnalyticsScreen(view));
  const aroundYouEnabled = consoleConfig.aroundYou.enabled || aroundYouTestMode;
  const idleInactivitySeconds = passengerTestMode ? 15 : consoleConfig.idleReset.inactivitySeconds;
  const idleFeatureRotationSeconds = passengerTestMode
    ? 10
    : consoleConfig.idleReset.featureRotationSeconds;
  const resetPassengerSession = useCallback(() => {
    setBookingOpen(false);
    setView("home");
    setRequestedGame(null);
    setQuickGameIndex((current) => current + 1);
    setLanguage(consoleConfig.idleReset.defaultLanguage);
    setSessionKey((current) => current + 1);
  }, [consoleConfig.idleReset.defaultLanguage]);
  const idleReset = usePassengerIdleReset({
    inactivitySeconds: idleInactivitySeconds,
    onReset: resetPassengerSession,
  });
  const simulatedAroundYouPlace = useMemo(
    () =>
      getAroundYouTestPresets(AROUND_YOU_SEED_PLACES).find(
        ({ id }) => id === simulatedAroundYouPlaceId,
      ) ?? null,
    [simulatedAroundYouPlaceId],
  );
  const passengerLocation = usePassengerLocation({
    enabled:
      aroundYouEnabled &&
      !simulatedAroundYouPlace &&
      !idleReset.promptOpen &&
      (view === "home" || view === "around-you"),
    options: consoleConfig.aroundYou.geolocation,
  });
  const weather = usePassengerWeather({
    online,
    refreshMinutes: consoleConfig.weather.refreshMinutes,
    fallbackCity: consoleConfig.weather.city,
    location: passengerLocation.position,
  });
  const aroundYouLocation = simulatedAroundYouPlace
    ? {
        status: "ready" as const,
        position: createAroundYouSimulatedPosition(simulatedAroundYouPlace),
        lastGoodPositionAgeMs: 0,
      }
    : passengerLocation;
  const aroundYou = useAroundYouEngine({
    enabled: aroundYouEnabled,
    location: aroundYouLocation,
    options: consoleConfig.aroundYou.selection,
    places: AROUND_YOU_SEED_PLACES,
    sessionKey,
  });
  const navigateTo = useCallback(
    (nextView: View) => {
      if (nextView === "home" && view !== "home") {
        setQuickGameIndex((current) => current + 1);
      }
      if (nextView === "music" && view !== "music") {
        analytics.track({ name: "music_opened", element: "music", interaction: true });
      }
      setView(nextView);
    },
    [analytics, view],
  );
  const openGame = useCallback(
    (game: PassengerGame, source: "idle" | "home" = "home") => {
      analytics.track({
        name: "game_opened",
        element: "game",
        metadata: { game, source },
        interaction: true,
      });
      setRequestedGame(game);
      setView("games");
    },
    [analytics],
  );
  const quickGame = PASSENGER_GAMES[quickGameIndex % PASSENGER_GAMES.length];
  const setAroundYouTestPreset = useCallback((placeId: string | null) => {
    setSimulatedAroundYouPlaceId(placeId);
    setSessionKey((current) => current + 1);
  }, []);
  const previousIdleRef = useRef<{ open: boolean; logicalRest: boolean }>({
    open: false,
    logicalRest: false,
  });

  useEffect(() => {
    const previous = previousIdleRef.current;
    if (!previous.open && idleReset.promptOpen) {
      analytics.track({
        name: idleReset.logicalRest ? "logical_rest_entered" : "idle_entered",
        screen: "idle",
        element: idleReset.logicalRest ? "logical_rest" : "idle",
      });
      analytics.endEngagement(idleReset.logicalRest ? "logical_rest" : "idle");
    }
    if (previous.open && !idleReset.promptOpen) {
      analytics.beginEngagement({
        source: previous.logicalRest ? "test_control" : "idle_resume",
        screen: "home",
      });
      analytics.track({
        name: previous.logicalRest ? "logical_rest_resumed" : "idle_resumed",
        screen: "idle",
        element: previous.logicalRest ? "logical_rest" : "idle",
        interaction: true,
      });
    }
    previousIdleRef.current = { open: idleReset.promptOpen, logicalRest: idleReset.logicalRest };
  }, [analytics, idleReset.logicalRest, idleReset.promptOpen]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/passenger-sw.js", { scope: "/passenger" }).catch(() => {
      // Offline recovery is progressive enhancement; the console stays usable without it.
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div
      className="passenger-console-theme h-dvh overflow-hidden bg-[#0B0B0B] text-white"
      data-passenger-theme={isLiteExperience ? consoleConfig.liteTheme : "original"}
    >
      <div
        className="passenger-console-shell mx-auto flex h-dvh w-full max-w-[740px] flex-col px-7 pb-4 pt-5"
        data-music-layout={
          consoleConfig.music.mode === "provider" && consoleConfig.music.providerName === "Spotify"
            ? "spotify"
            : "simulated"
        }
        data-view={view}
      >
        <ConsoleHeader
          config={config}
          language={language}
          online={online}
          setLanguage={setLanguage}
          status={online ? t.online : t.offline}
        />
        <main
          key={sessionKey}
          className="mt-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-5 pt-5"
        >
          {view === "home" && (
            <HomeView
              config={config}
              aroundYou={aroundYou}
              language={language}
              spotifyHomePollingEnabled={shouldPollSpotifyHome(view, idleReset.promptOpen)}
              onNavigate={navigateTo}
              onOpenGame={openGame}
              quickGame={quickGame}
              fallbackTemperatureFahrenheit={consoleConfig.weather.fallbackTemperatureFahrenheit}
              weather={weather.snapshot}
              weatherCity={weather.city}
              weatherStatus={weather.status}
              weatherAtmosphereActive={!idleReset.promptOpen}
              weatherAtmosphereOverride={weatherAtmosphereTestOverride}
              weatherAtmosphereTestMode={passengerTestMode}
              onWeatherAtmosphereOverrideChange={setWeatherAtmosphereTestOverride}
              t={t}
            />
          )}
          {view === "around-you" && (
            <AroundYouView
              language={language}
              onBack={() => navigateTo("home")}
              places={AROUND_YOU_SEED_PLACES}
              showDistance={consoleConfig.aroundYou.ui.showDistance}
              state={aroundYou}
              testMode={
                aroundYouTestMode
                  ? {
                      simulatedPlaceId: simulatedAroundYouPlaceId,
                      onSelectPreset: setAroundYouTestPreset,
                    }
                  : undefined
              }
            />
          )}
          {view === "music" && (
            <MusicView
              config={config}
              onMusicAction={(action) =>
                analytics.track({
                  name: "music_action",
                  element: "music_playback",
                  metadata: { action },
                  interaction: true,
                })
              }
              onNavigate={navigateTo}
              t={t}
            />
          )}
          {view === "games" && (
            <GamesView
              language={language}
              t={t}
              thisOrThatEnabled={consoleConfig.games.thisOrThatEnabled}
              utahHigherOrLowerEnabled={consoleConfig.games.utahHigherOrLowerEnabled}
              utahTriviaEnabled={consoleConfig.games.utahTriviaEnabled}
              requestedGame={requestedGame}
              onRequestedGameConsumed={consumeRequestedGame}
              phoneContinuation={consoleConfig.links.phoneContinuation}
              onGameCompleted={(game) =>
                analytics.track({ name: "game_completed", element: "game", metadata: { game } })
              }
              onGameOpened={(game) =>
                analytics.track({
                  name: "game_opened",
                  element: "game",
                  metadata: { game, source: "navigation" },
                  interaction: true,
                })
              }
              onGameStarted={(game) =>
                analytics.track({
                  name: "game_started",
                  element: "game",
                  metadata: { game },
                  interaction: true,
                })
              }
            />
          )}
          {view === "streex" && (
            <StreexView
              config={config}
              onBookRide={() => setBookingOpen(true)}
              onNavigate={navigateTo}
              phoneContinuation={consoleConfig.links.phoneContinuation}
              t={t}
            />
          )}
          {view === "meet-juan" && (
            <MeetJuanView
              config={config}
              language={language}
              onNavigate={navigateTo}
              reviews={visibleReviews}
              t={t}
            />
          )}
          {view === "services" && <ServicesView config={config} onNavigate={navigateTo} t={t} />}
          {view === "contact" && <ContactView config={config} onNavigate={navigateTo} t={t} />}
          {view === "reviews" && (
            <ReviewsView
              language={language}
              onNavigate={navigateTo}
              reviews={visibleReviews}
              t={t}
            />
          )}
          {view === "tip" && <TipView config={config} onNavigate={navigateTo} t={t} />}
          {view === "where-we-ride" && (
            <WhereWeRideView config={config} onNavigate={navigateTo} t={t} />
          )}
        </main>
        <ConsoleNavigation
          activeView={view}
          onNavigate={navigateTo}
          showAroundYou={!isLiteExperience}
          t={t}
        />
      </div>
      <BookingFormModal language={language} open={bookingOpen} onOpenChange={setBookingOpen} />
      {passengerTestMode && !idleReset.promptOpen && (
        <PassengerTestControls language={language} onEnterRest={idleReset.enterRest} />
      )}
      {idleReset.promptOpen && (
        <PassengerIdlePrompt
          config={config}
          featureRotationSeconds={idleFeatureRotationSeconds}
          fallbackTemperatureFahrenheit={consoleConfig.weather.fallbackTemperatureFahrenheit}
          language={language}
          logicalRest={idleReset.logicalRest}
          onExploreMusic={() => {
            idleReset.resume();
            navigateTo("music");
          }}
          onExploreGame={() => {
            idleReset.resume();
            openGame(quickGame, "idle");
          }}
          onExploreStreex={() => {
            idleReset.resume();
            navigateTo("streex");
          }}
          onExploreServices={() => {
            idleReset.resume();
            navigateTo("services");
          }}
          onExploreYourRide={() => {
            idleReset.resume();
            navigateTo("where-we-ride");
          }}
          onResume={idleReset.resume}
          weather={weather.snapshot}
          weatherCity={weather.city}
          weatherAtmosphereOverride={weatherAtmosphereTestOverride}
        />
      )}
    </div>
  );
}

function PassengerIdlePrompt({
  config,
  featureRotationSeconds,
  fallbackTemperatureFahrenheit,
  language,
  logicalRest,
  onExploreGame,
  onExploreMusic,
  onExploreServices,
  onExploreStreex,
  onExploreYourRide,
  onResume,
  weather,
  weatherCity,
  weatherAtmosphereOverride,
}: {
  config: AppConfig;
  featureRotationSeconds: number;
  fallbackTemperatureFahrenheit: number;
  language: Language;
  logicalRest: boolean;
  onExploreGame: () => void;
  onExploreMusic: () => void;
  onExploreServices: () => void;
  onExploreStreex: () => void;
  onExploreYourRide: () => void;
  onResume: () => void;
  weather: PassengerWeatherSnapshot | null;
  weatherCity: string;
  weatherAtmosphereOverride: AtmosphereVariant | null;
}) {
  const primary = copy[language];
  const idleSecondaryRotation = useIdleSecondaryRotation(featureRotationSeconds * 1_000);
  const now = useClock();
  const time = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: config.passengerConsole.clock.localTimeZone,
      })
    : "--:--";
  const temperatureFahrenheit =
    weather?.periods[0]?.temperatureFahrenheit ?? fallbackTemperatureFahrenheit;
  const temperatureCelsius = Math.round(((temperatureFahrenheit - 32) * 5) / 9);

  return (
    <div
      onClick={onResume}
      className={`passenger-idle-prompt fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-[#080808]/95 p-8 text-left text-white backdrop-blur-xl focus:outline-none focus:ring-4 focus:ring-inset focus:ring-[#E6CE20]/60${
        logicalRest ? " passenger-idle-prompt--logical-rest" : ""
      }`}
    >
      <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E6CE20]/10 blur-[130px]" />
      <div className="passenger-idle-content passenger-idle-content--music relative flex w-full max-w-5xl flex-col items-center gap-6">
        <div className="passenger-idle-header flex w-full items-center justify-between gap-5">
          <img
            src={config.logoSrc}
            alt={config.brandName}
            className="h-14 w-auto max-w-[220px] object-contain"
          />
          <span className="passenger-idle-meta flex shrink-0 items-center gap-4 text-right">
            <span className="text-3xl font-black tabular-nums tracking-tight sm:text-4xl">
              {time}
            </span>
            <span className="h-9 w-px bg-[#E6CE20]/45" aria-hidden="true" />
            <span className="flex items-center gap-2 text-base font-semibold text-white/65 sm:text-lg">
              <Cloud className="h-5 w-5 text-[#E6CE20]" />
              {Math.round(temperatureFahrenheit)}°F · {temperatureCelsius}°C
            </span>
          </span>
        </div>

        <IdleSpotifyNowPlaying
          enabled={
            config.passengerConsole.music.mode === "provider" &&
            config.passengerConsole.music.providerName === "Spotify"
          }
          onExploreMusic={onExploreMusic}
          t={primary}
        />
        <section className="passenger-idle-glance w-full" aria-label="Streex glance">
          <div className="passenger-idle-glance-rotating">
            <span className="passenger-idle-glance-label">STREEX GLANCE</span>
            <IdleSecondaryRail
              config={config}
              fallbackTemperatureFahrenheit={fallbackTemperatureFahrenheit}
              feature={idleSecondaryRotation.feature}
              language={language}
              onExploreStreex={onExploreStreex}
              weather={weather}
              weatherCity={weatherCity}
              weatherAtmosphereOverride={weatherAtmosphereOverride}
            />
          </div>
          <IdlePhoneContinuation config={config} t={primary} />
        </section>

        <IdleExplorePanel
          language={language}
          onExploreGame={onExploreGame}
          onExploreMusic={onExploreMusic}
          onExploreServices={onExploreServices}
          onExploreStreex={onExploreStreex}
          onExploreYourRide={onExploreYourRide}
          t={primary}
        />
      </div>
    </div>
  );
}

function PassengerTestControls({
  language,
  onEnterRest,
}: {
  language: Language;
  onEnterRest: () => void;
}) {
  const isSpanish = language === "es";

  return (
    <aside
      className="passenger-test-controls fixed bottom-5 right-5 z-[90] max-w-[280px] rounded-2xl border border-[#E6CE20]/45 bg-[#0B0B0B]/95 p-3 text-white shadow-2xl backdrop-blur"
      aria-label={isSpanish ? "Controles privados de prueba" : "Private test controls"}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E6CE20]">
        {isSpanish ? "Herramienta privada" : "Private tool"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/65">
        {isSpanish
          ? "Prueba el reposo lógico. El brillo físico se controla desde Fully Remote."
          : "Test logical rest. Physical brightness stays controlled in Fully Remote."}
      </p>
      <button
        type="button"
        onClick={onEnterRest}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E6CE20] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f4d249] focus:outline-none focus:ring-4 focus:ring-[#E6CE20]/40"
      >
        <MoonStar className="h-4 w-4" />
        {isSpanish ? "Probar reposo" : "Test rest mode"}
      </button>
    </aside>
  );
}

type IdleSecondaryFeature = "weather-hourly" | "weather-daily" | "streex";

const IDLE_SECONDARY_FEATURES: readonly IdleSecondaryFeature[] = [
  "weather-hourly",
  "weather-daily",
  "streex",
];

function useIdleSecondaryRotation(intervalMs: number) {
  const [featureIndex, setFeatureIndex] = useState(0);

  useEffect(() => {
    setFeatureIndex(0);
    const timer = window.setInterval(() => {
      setFeatureIndex((current) => (current + 1) % IDLE_SECONDARY_FEATURES.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return {
    feature: IDLE_SECONDARY_FEATURES[featureIndex] ?? "weather-hourly",
  };
}

function getPassengerGamePresentation(
  game: PassengerGame,
  t: (typeof copy)[Language],
): {
  artwork: string;
  description: string;
  icon: React.ReactNode;
  title: string;
} {
  if (game === "choice") {
    return {
      artwork: THIS_OR_THAT_TRAILER_VISUALS[0]?.src ?? utahTriviaAtlas,
      description: t.thisOrThatDescription,
      icon: <ArrowLeftRight className="h-6 w-6" />,
      title: t.thisOrThat,
    };
  }

  if (game === "higher-lower") {
    return {
      artwork: utahTriviaAtlas,
      description: t.utahHigherOrLowerDescription,
      icon: <ArrowUpDown className="h-6 w-6" />,
      title: t.utahHigherOrLower,
    };
  }

  return {
    artwork: utahTriviaSymbols,
    description: t.utahTriviaDescription,
    icon: <HoneycombMark />,
    title: t.utahTrivia,
  };
}

function IdleSecondaryRail({
  config,
  fallbackTemperatureFahrenheit,
  feature,
  language,
  onExploreStreex,
  weather,
  weatherCity,
  weatherAtmosphereOverride,
}: {
  config: AppConfig;
  fallbackTemperatureFahrenheit: number;
  feature: IdleSecondaryFeature;
  language: Language;
  onExploreStreex: () => void;
  weather: PassengerWeatherSnapshot | null;
  weatherCity: string;
  weatherAtmosphereOverride: AtmosphereVariant | null;
}) {
  const t = copy[language];
  const current = weather?.periods[0];
  const currentTemperature = current?.temperatureFahrenheit ?? fallbackTemperatureFahrenheit;
  const currentCondition = current?.condition ?? "unknown";
  const weatherAtmosphere =
    weatherAtmosphereOverride ??
    atmosphereForWeather(
      currentCondition,
      current
        ? isNightAt(new Date(current.startTime), config.passengerConsole.clock.localTimeZone)
        : false,
    );
  const hourlyForecast = weather?.periods.slice(1, 5) ?? [];
  const dailyForecast = weather?.dailyPeriods?.slice(0, 4) ?? [];
  if (feature === "streex") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onExploreStreex();
        }}
        className="passenger-idle-secondary passenger-idle-secondary--streex group text-left"
      >
        <span className="relative flex h-full items-center justify-between gap-5 px-6 py-4 sm:px-8">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#E6CE20]">
              <Sparkles className="h-4 w-4" />
              {t.idleStreexEyebrow}
            </span>
            <span className="mt-1 block text-xl font-black tracking-tight sm:text-2xl">
              {t.idleStreexTitle}
            </span>
            <span className="mt-1 block max-w-xl text-sm text-white/70">
              {t.idleStreexDescription}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E6CE20] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">
            {t.idleStreexAction}
            <ChevronRight className="h-4 w-4" />
          </span>
        </span>
      </button>
    );
  }

  const forecast = feature === "weather-daily" ? dailyForecast : hourlyForecast;
  const forecastTitle = feature === "weather-daily" ? t.idleWeatherDays : t.idleWeatherHours;

  return (
    <section
      className="passenger-idle-secondary passenger-idle-secondary--weather passenger-idle-secondary--forecast"
      aria-label={forecastTitle}
    >
      <WeatherAtmosphere variant={weatherAtmosphere} />
      <div className="relative z-10 flex min-w-0 items-center gap-4 px-6 py-4 sm:px-8">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#E6CE20]/35 bg-[#E6CE20]/10 text-[#E6CE20]">
          <WeatherConditionIcon condition={currentCondition} className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#E6CE20]">
            {forecastTitle}
          </span>
          <span className="mt-1 flex items-baseline gap-2">
            <strong className="text-3xl font-black tabular-nums tracking-tight">
              {Math.round(currentTemperature)}°F
            </strong>
            <span className="truncate text-sm text-white/70">
              {feature === "weather-daily"
                ? weatherCity
                : weatherConditionLabel(currentCondition, t)}
            </span>
          </span>
        </span>
      </div>
      <div className="passenger-idle-forecast relative z-10">
        <span className="passenger-idle-forecast-label">{t.idleWeatherHours}</span>
        <div className="flex min-w-0 flex-1 items-center justify-around gap-2">
          {forecast.map((period) => (
            <span
              key={period.startTime}
              className="grid min-w-0 justify-items-center gap-1 text-center"
            >
              <span className="text-[10px] font-bold text-white/60">
                {feature === "weather-daily"
                  ? formatIdleWeatherDay(period.startTime, language)
                  : formatIdleWeatherHour(period.startTime, language)}
              </span>
              <WeatherConditionIcon
                condition={period.condition}
                className="h-4 w-4 text-[#E6CE20]"
              />
              <span className="text-xs font-black tabular-nums">
                {Math.round(period.temperatureFahrenheit)}°
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function IdlePhoneContinuation({ config, t }: { config: AppConfig; t: (typeof copy)[Language] }) {
  return (
    <aside className="passenger-idle-phone-continuation" aria-label={t.continuePhone}>
      <Phone className="passenger-idle-phone-icon" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight text-white">
          {t.continuePhone}
        </span>
        <span className="mt-1 block text-sm text-white/50">{t.idlePhoneScan}</span>
      </span>
      <span className="rounded-2xl bg-white p-1.5 shadow-xl">
        <QRCodeSVG
          value={config.passengerConsole.links.phoneContinuation}
          size={76}
          level="M"
          includeMargin={false}
        />
      </span>
    </aside>
  );
}

function IdleExplorePanel({
  language,
  onExploreGame,
  onExploreMusic,
  onExploreServices,
  onExploreStreex,
  onExploreYourRide,
  t,
}: {
  language: Language;
  onExploreGame: () => void;
  onExploreMusic: () => void;
  onExploreServices: () => void;
  onExploreStreex: () => void;
  onExploreYourRide: () => void;
  t: (typeof copy)[Language];
}) {
  const items = [
    {
      icon: <Gamepad2 />,
      label: t.games,
      detail: language === "es" ? "Juega y disfruta" : "Play & enjoy",
      onClick: onExploreGame,
    },
    {
      icon: <MapPin />,
      label: language === "es" ? "Tu viaje" : "Your Ride",
      detail: language === "es" ? "Descubre Streex" : "Explore Streex",
      onClick: onExploreYourRide,
    },
    {
      icon: <Music2 />,
      label: t.music,
      detail: language === "es" ? "Controla y explora" : "Control & browse",
      onClick: onExploreMusic,
    },
    {
      icon: <Menu />,
      label: t.services,
      detail: language === "es" ? "Viajes y más" : "Rides & more",
      onClick: onExploreServices,
    },
    {
      icon: <Sparkles />,
      label: language === "es" ? "Más" : "More",
      detail: language === "es" ? "Explora Streex" : "Explore Streex",
      onClick: onExploreStreex,
    },
  ];

  return (
    <section className="passenger-idle-explore w-full" aria-label="Explore Streex">
      <span className="passenger-idle-explore-label">EXPLORE STREEX</span>
      <div className="passenger-idle-explore-actions">
        <div className="passenger-idle-explore-links">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                item.onClick();
              }}
              className="passenger-idle-explore-link"
            >
              <span className="passenger-idle-explore-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                <span className="mt-1 block text-xs text-white/45">{item.detail}</span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExploreStreex();
          }}
          className="passenger-idle-explore-cta"
        >
          <span>TAP TO EXPLORE</span>
          <small>
            {language === "es"
              ? "Juegos · Música · Tu viaje · Más"
              : "Games · Music · Your ride · More"}
          </small>
        </button>
      </div>
    </section>
  );
}

function formatIdleWeatherHour(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
    hour: "numeric",
  }).format(new Date(value));
}

function formatIdleWeatherDay(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
    weekday: "short",
  }).format(new Date(value));
}

function IdleSpotifyNowPlaying({
  compact = false,
  enabled,
  onExploreMusic,
  t,
}: {
  compact?: boolean;
  enabled: boolean;
  onExploreMusic: () => void;
  t: (typeof copy)[Language];
}) {
  const [status, setStatus] = useState<SpotifyPlaybackState | null>(null);
  const [busy, setBusy] = useState(false);
  const isMountedRef = useRef(false);
  const lifecycleRef = useRef(0);
  const postControlRefreshRef = useRef<ReturnType<
    typeof createSpotifyPostControlRefreshScheduler
  > | null>(null);

  useEffect(() => {
    let isMounted = true;
    const lifecycle = ++lifecycleRef.current;
    isMountedRef.current = true;
    const postControlRefresh = createSpotifyPostControlRefreshScheduler({
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (timer) => window.clearTimeout(timer),
    });
    postControlRefreshRef.current = postControlRefresh;

    const refresh = async () => {
      try {
        const next = await getSharedPersonalSpotifyPlayback();
        if (isMounted) setStatus(next);
      } catch {
        if (isMounted) setStatus(null);
      }
    };

    const stopPolling = startSpotifyPolling({
      refresh,
      intervalMs: 10_000,
      enabled,
      refreshOnlyWhenVisible: true,
    });
    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (lifecycleRef.current === lifecycle) lifecycleRef.current += 1;
      postControlRefresh.dispose();
      if (postControlRefreshRef.current === postControlRefresh) {
        postControlRefreshRef.current = null;
      }
      stopPolling();
    };
  }, [enabled]);

  const playback = status?.state === "ready" ? status.playback : null;
  const track = playback?.track ?? null;
  const isDiscoverable = !track;
  const artworkPalette = useArtworkPalette(track?.artworkUrl ?? null);
  const liveProgressMs = useInterpolatedSpotifyProgress(
    track?.progressMs,
    track?.durationMs,
    playback?.isPlaying,
  );
  const trackProgress = track?.durationMs
    ? Math.min(100, Math.max(0, (liveProgressMs / track.durationMs) * 100))
    : null;
  const control = async (command: "play" | "pause" | "next") => {
    if (!isMountedRef.current) return;
    const lifecycle = lifecycleRef.current;
    setBusy(true);
    try {
      await controlPersonalSpotifyPlayback({ data: { command } });
      if (!isMountedRef.current || lifecycleRef.current !== lifecycle) return;
      postControlRefreshRef.current?.schedule(
        command === "next" ? 800 : 300,
        getSharedPersonalSpotifyPlayback,
        setStatus,
        () => setStatus(null),
      );
    } finally {
      if (isMountedRef.current && lifecycleRef.current === lifecycle) setBusy(false);
    }
  };
  const className = `passenger-idle-music grid w-full max-w-4xl items-center gap-7${
    isDiscoverable ? " passenger-idle-music--discover" : ""
  }${compact ? " passenger-idle-music--compact" : ""}`;

  const content = (
    <>
      {track?.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt=""
          className="passenger-idle-artwork aspect-square w-full rounded-[28px] object-cover shadow-2xl"
        />
      ) : (
        <span
          aria-hidden="true"
          className="passenger-idle-artwork passenger-idle-soundboard grid aspect-square w-full place-items-center rounded-[28px] text-black shadow-2xl"
        >
          <span className="passenger-idle-soundboard-orbit passenger-idle-soundboard-orbit--outer" />
          <span className="passenger-idle-soundboard-orbit passenger-idle-soundboard-orbit--inner" />
          <span className="passenger-idle-soundboard-choices">
            <span>{t.idleMusicSearch}</span>
            <span>{t.idleMusicTop}</span>
            <span>{t.idleMusicVibes}</span>
          </span>
          <span className="passenger-idle-soundboard-core">
            <span className="passenger-idle-soundboard-equalizer">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
            <Music2 className="passenger-idle-soundboard-note" />
          </span>
        </span>
      )}
      <span className="passenger-idle-track-copy min-w-0">
        <span className="passenger-idle-now-playing-row flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#E6CE20]">
          <span className="flex items-center gap-3">
            {playback?.isPlaying && (
              <span className="flex h-5 items-end gap-1" aria-hidden="true">
                <span className="h-2 w-1 animate-pulse rounded-full bg-[#E6CE20]" />
                <span className="h-5 w-1 animate-pulse rounded-full bg-[#E6CE20]" />
                <span className="h-3 w-1 animate-pulse rounded-full bg-[#E6CE20]" />
              </span>
            )}
            {playback?.isPlaying
              ? t.idleNowPlaying
              : isDiscoverable
                ? t.idleMusicPrompt
                : t.idleMusicReady}
          </span>
          <button
            type="button"
            className="passenger-idle-open-music"
            onClick={(event) => {
              event.stopPropagation();
              onExploreMusic();
            }}
          >
            <Music2 aria-hidden="true" />
            Tap to open Music
          </button>
        </span>
        <SpotifyMarquee className="passenger-idle-track-title mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {track?.title ?? t.idleChooseMusic}
        </SpotifyMarquee>
        {track ? (
          <span className="passenger-idle-track-details mt-3 block">
            <span className="block text-lg font-medium text-white/80">{track.artist}</span>
            {track.album ? (
              <span className="mt-1 block text-base text-white/48">{track.album}</span>
            ) : null}
          </span>
        ) : (
          <span className="passenger-idle-track-subtitle mt-3 text-lg text-white/55">
            {t.idleChooseMusicDescription}
          </span>
        )}
        {track && trackProgress !== null ? (
          <span className="passenger-idle-progress mt-6 block max-w-xl">
            <span className="block h-1.5 overflow-hidden rounded-full bg-white/15">
              <span
                className="block h-full rounded-full bg-[#E6CE20] transition-[width] duration-500"
                style={{ width: `${trackProgress}%` }}
              />
            </span>
            <span className="mt-2 flex justify-between text-xs font-medium tabular-nums text-white/50">
              <span>{formatSpotifyDuration(liveProgressMs)}</span>
              <span>{formatSpotifyDuration(track.durationMs)}</span>
            </span>
          </span>
        ) : null}
        {track ? (
          <span className="passenger-idle-playback-controls mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !playback?.hasActiveDevice}
              aria-label={playback?.isPlaying ? "Pause" : "Play"}
              onClick={(event) => {
                event.stopPropagation();
                void control(playback?.isPlaying ? "pause" : "play");
              }}
            >
              {playback?.isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </button>
            <button
              type="button"
              disabled={busy || !playback?.hasActiveDevice}
              aria-label="Next"
              onClick={(event) => {
                event.stopPropagation();
                void control("next");
              }}
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </span>
        ) : null}
        {isDiscoverable && (
          <span className="passenger-idle-discovery mt-5 flex flex-wrap items-center gap-3">
            <span className="passenger-idle-discovery-pills flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
              <span>{t.idleMusicSearch}</span>
              <span>{t.idleMusicTop}</span>
              <span>{t.idleMusicVibes}</span>
            </span>
            <span className="passenger-idle-discovery-action inline-flex items-center gap-2 rounded-full bg-[#E6CE20] px-4 py-2 text-xs font-black text-black shadow-[0_0_25px_rgba(230,206,32,0.18)]">
              <Search className="h-4 w-4" />
              {t.chooseMusic}
              <ChevronRight className="h-4 w-4" />
            </span>
          </span>
        )}
        {track ? (
          <MusicVisualizer active={Boolean(playback?.isPlaying)} compact palette={artworkPalette} />
        ) : null}
      </span>
    </>
  );

  if (!isDiscoverable)
    return (
      <div className={className} style={ambientStyle(artworkPalette)}>
        {content}
      </div>
    );

  return (
    <button
      type="button"
      className={className}
      style={ambientStyle(artworkPalette)}
      onClick={(event) => {
        event.stopPropagation();
        onExploreMusic();
      }}
    >
      {content}
    </button>
  );
}

function ConsoleHeader({
  config,
  language,
  online,
  setLanguage,
  status,
}: {
  config: AppConfig;
  language: Language;
  online: boolean;
  setLanguage: (language: Language) => void;
  status: string;
}) {
  return (
    <header className="passenger-console-header relative z-20 flex shrink-0 items-center justify-between gap-3 bg-[#0B0B0B]">
      <div className="flex min-w-0 items-center">
        <img
          src={config.logoSrc}
          alt={config.brandName}
          className="h-11 w-auto max-w-[154px] shrink-0 object-contain"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65 sm:flex">
          <span
            className={`h-2 w-2 rounded-full ${online ? "bg-[#E6CE20] shadow-[0_0_10px_#E6CE20]" : "bg-white/35"}`}
          />
          {status}
          <Wifi className="h-3.5 w-3.5" />
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
          {(["en", "es"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={language === option}
              onClick={() => setLanguage(option)}
              className={`rounded-full px-3 py-1.5 transition ${
                language === option ? "bg-[#E6CE20] text-black" : "text-white/55"
              }`}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function HomeView({
  aroundYou,
  config,
  language,
  spotifyHomePollingEnabled,
  onNavigate,
  onOpenGame,
  quickGame,
  fallbackTemperatureFahrenheit,
  weather,
  weatherCity,
  weatherStatus,
  weatherAtmosphereActive,
  weatherAtmosphereOverride,
  weatherAtmosphereTestMode,
  onWeatherAtmosphereOverrideChange,
  t,
}: {
  aroundYou: import("./around-you/around-you-types").AroundYouEngineState;
  config: AppConfig;
  language: Language;
  spotifyHomePollingEnabled: boolean;
  onNavigate: (view: View) => void;
  onOpenGame: (game: PassengerGame) => void;
  quickGame: PassengerGame;
  fallbackTemperatureFahrenheit: number;
  weather: PassengerWeatherSnapshot | null;
  weatherCity: string;
  weatherStatus: PassengerWeatherStatus;
  weatherAtmosphereActive: boolean;
  weatherAtmosphereOverride: AtmosphereVariant | null;
  weatherAtmosphereTestMode: boolean;
  onWeatherAtmosphereOverrideChange: (value: AtmosphereVariant | null) => void;
  t: (typeof copy)[Language];
}) {
  const now = useClock();
  const [weatherOpen, setWeatherOpen] = useState(false);
  const locale = language === "es" ? "es-MX" : "en-US";
  const clockConfig = config.passengerConsole.clock;
  const time = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: clockConfig.localTimeZone,
      })
    : "--:--";
  const date = now
    ? now.toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: clockConfig.localTimeZone,
      })
    : "";
  const eastTime = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: clockConfig.secondaryTimeZones.east,
      })
    : "--:--";
  const pacificTime = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: clockConfig.secondaryTimeZones.pacific,
      })
    : "--:--";
  const centralTime = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: clockConfig.secondaryTimeZones.central,
      })
    : "--:--";
  const temperatureFahrenheit =
    weather?.periods[0]?.temperatureFahrenheit ?? fallbackTemperatureFahrenheit;
  const temperature =
    language === "es"
      ? `${Math.round(((temperatureFahrenheit - 32) * 5) / 9)}°C`
      : `${Math.round(temperatureFahrenheit)}°F`;
  const homeCurrentWeather = weather?.periods[0];
  const homeAtmosphere =
    weatherAtmosphereOverride ??
    atmosphereForWeather(
      homeCurrentWeather?.condition ?? "clear",
      isNightAt(now, clockConfig.localTimeZone),
    );
  const quickGamePresentation = getPassengerGamePresentation(quickGame, t);

  return (
    <div className="passenger-home-layout flex flex-1 flex-col gap-5">
      <section className="passenger-home-hero relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-[#E6CE20]/15 p-6">
        <img
          src={passengerHomeAirport}
          alt=""
          aria-hidden="true"
          className="passenger-home-hero-image absolute inset-y-0 right-0 h-full w-[58%] object-cover object-center"
        />
        <span className="passenger-home-hero-image-scrim absolute inset-0" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#E6CE20]/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E6CE20]">
              {t.privateRide}
            </p>
            <p className="shrink-0 text-[10px] font-semibold text-white/45">
              {t.hostedBy} {config.ownerName}
            </p>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{t.welcome}</h1>
          <p className="mt-2 text-base text-white/60">{t.subtitle}</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#E6CE20]">
            <Sparkles className="h-3.5 w-3.5" />
            {t.exploreCue}
          </p>
          <div className="passenger-home-time mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {t.localTime}
              </p>
              <p className="text-5xl font-black tracking-tight tabular-nums sm:text-6xl">{time}</p>
              <p className="mt-1 text-sm capitalize text-white/55">{date}</p>
            </div>
            <button
              type="button"
              onClick={() => setWeatherOpen(true)}
              aria-label={`${t.weather}: ${weatherCity}. ${t.weatherHint}`}
              className="passenger-home-weather relative isolate min-w-[208px] overflow-hidden rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-left backdrop-blur transition hover:border-[#E6CE20]/40 hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-[#E6CE20]/60"
            >
              <WeatherAtmosphere variant={homeAtmosphere} active={weatherAtmosphereActive} />
              <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                {t.weather}
              </p>
              <span className="relative z-10 mt-2 flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20 text-[#E6CE20] backdrop-blur-sm">
                  <WeatherConditionIcon
                    condition={weather?.periods[0]?.condition ?? "unknown"}
                    className="h-7 w-7"
                    night={isNightAt(now, clockConfig.localTimeZone)}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-3xl font-black leading-none tracking-tight">
                    {temperature}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-white/75">
                    {weatherConditionLabel(weather?.periods[0]?.condition ?? "unknown", t)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-white/55">{weatherCity}</span>
                </span>
              </span>
              <span className="relative z-10 mt-2 flex items-center gap-1 text-[9px] font-semibold text-[#E6CE20]">
                {weatherStatus === "unavailable" && !weather ? t.weatherUnavailable : t.weatherHint}{" "}
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          </div>
          <div className="passenger-home-secondary-clocks mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3">
            <SecondaryClock label={t.newYork} time={eastTime} />
            <SecondaryClock label={t.dallas} time={centralTime} />
            <SecondaryClock label={t.losAngeles} time={pacificTime} />
          </div>
        </div>
      </section>

      <WeatherDetailDialog
        city={weatherCity}
        language={language}
        open={weatherOpen}
        onOpenChange={setWeatherOpen}
        fallbackTemperatureFahrenheit={fallbackTemperatureFahrenheit}
        weather={weather}
        weatherStatus={weatherStatus}
        timeZone={clockConfig.localTimeZone}
        atmosphereOverride={weatherAtmosphereOverride}
        showAtmosphereTestControls={weatherAtmosphereTestMode}
        onAtmosphereOverrideChange={onWeatherAtmosphereOverrideChange}
        t={t}
      />

      <div className="passenger-home-music">
        {config.passengerConsole.music.mode === "provider" &&
        config.passengerConsole.music.providerName === "Spotify" ? (
          <PersonalSpotifyHomeCard
            onNavigate={onNavigate}
            pollingEnabled={spotifyHomePollingEnabled}
            t={t}
          />
        ) : (
          <button
            type="button"
            onClick={() => onNavigate("music")}
            className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]"
          >
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#E6CE20] to-amber-600 text-black">
              <Play className="h-7 w-7 fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
                {t.nowPlaying}
              </span>
              <span className="mt-1 block truncate text-lg font-bold">
                {MUSIC_LIBRARY[0].title}
              </span>
              <span className="block truncate text-sm text-white/55">
                {MUSIC_LIBRARY[0].artist} · {MUSIC_LIBRARY[0].album}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#E6CE20]/35 bg-[#E6CE20]/10 px-3 py-2 text-right text-[#E6CE20]">
              <span className="hidden max-w-32 text-xs leading-tight sm:block">
                <span className="block font-semibold">{t.chooseMusic}</span>
                <span className="mt-0.5 block text-[10px] text-white/55">{t.musicHint}</span>
              </span>
              <span className="text-xs font-semibold sm:hidden">{t.chooseMusic}</span>
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>

      <section className="passenger-home-quick-access">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {t.quickAccess}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <QuickAccessCard
            accent
            badge={t.playNow}
            icon={quickGamePresentation.icon}
            label={quickGamePresentation.title}
            description={quickGamePresentation.description}
            onClick={() => onOpenGame(quickGame)}
            artwork={quickGamePresentation.artwork}
          />
          {config.passengerConsole.aroundYou.ui.showHomeCard && (
            <AroundYouHomeCard
              language={language}
              onOpen={() => onNavigate("around-you")}
              state={aroundYou}
            />
          )}
        </div>
      </section>

      <section className="passenger-home-ticker overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.025]">
        <ServiceTicker config={config} />
      </section>
      <button
        type="button"
        onClick={() => onNavigate("meet-juan")}
        className="passenger-home-host group relative flex min-h-[104px] items-center gap-4 overflow-hidden rounded-[26px] border border-[#E6CE20]/20 bg-gradient-to-r from-[#E6CE20]/10 via-white/[0.045] to-white/[0.02] p-4 text-left transition hover:border-[#E6CE20]/45 hover:bg-[#E6CE20]/[0.1]"
      >
        <span className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-[#E6CE20]/15 blur-3xl" />
        <img
          src={config.meetPhoto}
          alt={config.ownerName}
          loading="lazy"
          decoding="async"
          className="relative h-16 w-16 shrink-0 rounded-2xl border border-[#E6CE20]/35 object-cover shadow-[0_0_20px_rgba(230,206,32,0.12)]"
        />
        <span className="relative min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
            {t.hostCardEyebrow}
          </span>
          <span className="mt-1 block text-lg font-extrabold">{config.ownerName}</span>
          <span className="mt-1 block truncate text-sm text-white/60">{t.hostCardDescription}</span>
        </span>
        <span className="relative flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#E6CE20]">
          {t.meetJuan}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </div>
  );
}

function SecondaryClock({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2 text-center">
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">
        {label}
      </span>
      <span className="text-[10px] font-semibold tabular-nums text-white/75">{time}</span>
    </div>
  );
}

function isNightAt(now: Date | null, timeZone: string) {
  if (!now) return false;
  const hour = Number(
    now.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }),
  );
  return Number.isFinite(hour) && (hour >= 19 || hour < 6);
}

function WeatherDetailDialog({
  city,
  fallbackTemperatureFahrenheit,
  language,
  onOpenChange,
  open,
  atmosphereOverride,
  onAtmosphereOverrideChange,
  showAtmosphereTestControls,
  timeZone,
  t,
  weather,
  weatherStatus,
}: {
  city: string;
  fallbackTemperatureFahrenheit: number;
  language: Language;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  atmosphereOverride: AtmosphereVariant | null;
  onAtmosphereOverrideChange: (value: AtmosphereVariant | null) => void;
  showAtmosphereTestControls: boolean;
  timeZone: string;
  t: (typeof copy)[Language];
  weather: PassengerWeatherSnapshot | null;
  weatherStatus: PassengerWeatherStatus;
}) {
  const locale = language === "es" ? "es-MX" : "en-US";
  const formatTemperature = (temperatureFahrenheit: number) =>
    language === "es"
      ? `${Math.round(((temperatureFahrenheit - 32) * 5) / 9)}°C`
      : `${Math.round(temperatureFahrenheit)}°F`;
  const forecast = (weather?.periods ?? []).slice(0, 4).map((period) => {
    const forecastDate = new Date(period.startTime);
    return {
      label: forecastDate.toLocaleTimeString(locale, {
        hour: "numeric",
        timeZone,
      }),
      temperature: formatTemperature(period.temperatureFahrenheit),
      period,
    };
  });
  const dailyForecast = (weather?.dailyPeriods ?? []).slice(0, 4).map((period) => {
    const forecastDate = new Date(period.startTime);
    return {
      label: forecastDate.toLocaleDateString(locale, {
        weekday: "short",
        timeZone,
      }),
      date: forecastDate.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        timeZone,
      }),
      temperature: formatTemperature(period.temperatureFahrenheit),
      period,
    };
  });
  const current = weather?.periods[0];
  const currentNight = current ? isNightAt(new Date(current.startTime), timeZone) : false;
  const automaticAtmosphere = atmosphereForWeather(current?.condition ?? "clear", currentNight);
  const atmosphere = atmosphereOverride ?? automaticAtmosphere;
  const updatedAt = weather
    ? new Date(weather.updatedAt).toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 flex h-[40rem] w-[62rem] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-hidden rounded-[30px] border-white/10 bg-[#0B0B0B] p-5 text-white sm:p-6">
        <WeatherAtmosphere variant={atmosphere} active={open} className="rounded-[30px]" />
        <DialogHeader className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-left text-2xl font-extrabold">
                {t.weatherDetailTitle}
              </DialogTitle>
              <DialogDescription className="text-left text-white/55">
                {t.weatherDetailDescription} {city}.
              </DialogDescription>
            </div>
            {showAtmosphereTestControls && (
              <div className="flex shrink-0 gap-1 rounded-full border border-white/10 bg-black/45 p-1 backdrop-blur">
                {WEATHER_ATMOSPHERE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onAtmosphereOverrideChange(option.id)}
                    className={`rounded-full px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] transition ${
                      atmosphere === option.id
                        ? "bg-[#E6CE20] text-black"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogHeader>

        {current ? (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] sm:items-center">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-[22px] border border-white/[0.08] bg-white/[0.07] text-white/90">
                    <WeatherConditionIcon
                      condition={current.condition}
                      className="h-9 w-9"
                      night={currentNight}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                      {t.weatherNow} · {city}
                    </p>
                    <p className="mt-1 text-5xl font-black leading-none tracking-tight">
                      {formatTemperature(current.temperatureFahrenheit)}
                    </p>
                    <p className="mt-1.5 truncate text-lg font-bold text-[#E6CE20]">
                      {weatherConditionLabel(current.condition, t)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm leading-snug text-white/55">
                      {current.shortForecast}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <WeatherMetric
                    label={t.precipitation}
                    value={
                      current.precipitationChance === null ? "—" : `${current.precipitationChance}%`
                    }
                    progress={current.precipitationChance}
                  />
                  <WeatherMetric
                    label={t.wind}
                    value={
                      [current.windDirection, current.windSpeed].filter(Boolean).join(" ") || "—"
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
                {t.nextHours}
              </p>
              <div className="grid grid-cols-4 divide-x divide-white/[0.07] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                {forecast.map((hour, index) => (
                  <div
                    key={`${hour.label}-${index}`}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2.5 text-center ${index === 0 ? "bg-white/[0.08]" : ""}`}
                  >
                    <p className="text-xs font-semibold text-white/60">{hour.label}</p>
                    <WeatherConditionIcon
                      condition={hour.period.condition}
                      className="h-6 w-6 text-white/90"
                      night={isNightAt(new Date(hour.period.startTime), timeZone)}
                    />
                    <p className="text-xl font-black leading-none">{hour.temperature}</p>
                    <p className="line-clamp-1 text-[10px] leading-tight text-white/45">
                      {weatherConditionLabel(hour.period.condition, t)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {dailyForecast.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
                  {t.nextDays}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {dailyForecast.map((day, index) => (
                    <div
                      key={`${day.period.startTime}-${index}`}
                      className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl ${index === 0 ? "border-[#E6CE20]/30" : ""}`}
                    >
                      <WeatherConditionIcon
                        condition={day.period.condition}
                        className="h-6 w-6 shrink-0 text-white/90"
                      />
                      <div className="min-w-0 flex-1">
                        {index === 0 ? (
                          <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#E6CE20]">
                            {language === "es" ? "Mañana" : "Tomorrow"}
                          </p>
                        ) : null}
                        <p className="truncate text-xs font-bold capitalize text-white/80">
                          {day.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/45">{day.date}</p>
                      </div>
                      <p
                        className={`shrink-0 font-black ${index === 0 ? "text-[1.55rem]" : "text-xl"}`}
                      >
                        {day.temperature}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E6CE20]/25 bg-[#E6CE20]/[0.06] p-4">
            <p className="text-lg font-bold">{formatTemperature(fallbackTemperatureFahrenheit)}</p>
            <p className="mt-2 font-semibold text-white/80">{t.weatherUnavailable}</p>
            <p className="mt-1 text-sm text-white/55">{t.weatherUnavailableDescription}</p>
          </div>
        )}

        <div className="relative z-10 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/50">
          <Cloud className="h-4 w-4 text-[#E6CE20]" />
          <span>
            {updatedAt ? `${t.updated} ${updatedAt}` : t.weatherUnavailable}
            {weatherStatus === "unavailable" && weather ? ` · ${t.offline}` : ""}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function weatherConditionLabel(condition: PassengerWeatherCondition, t: (typeof copy)[Language]) {
  const labels: Record<PassengerWeatherCondition, string> = {
    clear: t.conditionClear,
    "mostly-clear": t.conditionMostlyClear,
    "partly-cloudy": t.conditionPartlyCloudy,
    cloudy: t.conditionCloudy,
    rain: t.conditionRain,
    thunderstorms: t.conditionThunderstorms,
    snow: t.conditionSnow,
    fog: t.conditionFog,
    smoke: t.conditionSmoke,
    wind: t.conditionWind,
    unknown: t.conditionUnknown,
  };
  return labels[condition];
}

function WeatherConditionIcon({
  className,
  condition,
  night = false,
}: {
  className?: string;
  condition: PassengerWeatherCondition;
  night?: boolean;
}) {
  const Icon =
    condition === "clear" || condition === "mostly-clear"
      ? night
        ? MoonStar
        : Sun
      : condition === "partly-cloudy" || condition === "cloudy"
        ? CloudSun
        : condition === "rain"
          ? CloudRain
          : condition === "thunderstorms"
            ? CloudLightning
            : condition === "snow"
              ? Snowflake
              : condition === "fog" || condition === "smoke"
                ? CloudFog
                : condition === "wind"
                  ? Wind
                  : Cloud;

  return <Icon className={className} aria-hidden="true" />;
}

function WeatherMetric({
  label,
  progress,
  value,
}: {
  label: string;
  progress?: number | null;
  value: string;
}) {
  const safeProgress =
    progress === null || progress === undefined ? null : Math.max(0, Math.min(100, progress));

  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </p>
      {safeProgress === null ? (
        <p className="mt-1 truncate text-sm font-bold">{value}</p>
      ) : (
        <div className="mt-1.5 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-[#E6CE20]"
              style={{ width: `${safeProgress}%` }}
            />
          </span>
          <span className="text-sm font-bold tabular-nums">{value}</span>
        </div>
      )}
    </div>
  );
}

function QuickAccessCard({
  accent = false,
  artwork,
  badge,
  description,
  icon,
  label,
  onClick,
}: {
  accent?: boolean;
  artwork?: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[166px] flex-col overflow-hidden rounded-[24px] border p-4 text-left transition ${
        accent
          ? "border-[#E6CE20]/65 bg-[#0B0B0B] text-white hover:border-[#E6CE20]"
          : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"
      }`}
    >
      {artwork && (
        <>
          <img src={artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.1)_0%,rgba(5,5,5,0.22)_38%,rgba(5,5,5,0.93)_100%)]" />
        </>
      )}
      <span className="flex items-start justify-between gap-2">
        <span
          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent ? "bg-[#E6CE20]/90 text-black" : "bg-[#E6CE20]/15 text-[#E6CE20]"}`}
        >
          {icon}
        </span>
        {badge && (
          <span
            className={`relative rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${
              accent ? "bg-[#E6CE20]/90 text-black" : "bg-[#E6CE20]/10 text-[#E6CE20]"
            }`}
          >
            {badge}
          </span>
        )}
      </span>
      <span
        className={`relative mt-auto block text-base font-bold leading-tight ${accent ? "text-white" : ""}`}
      >
        {label} <ChevronRight className="inline h-4 w-4" />
      </span>
      <span
        className={`relative mt-1 block text-xs leading-snug ${accent ? "text-white/70" : "text-white/55"}`}
      >
        {description}
      </span>
    </button>
  );
}

function MusicView({
  config,
  onMusicAction,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onMusicAction: (action: "play" | "pause" | "next" | "search" | "top_50" | "vibes") => void;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  const music = config.passengerConsole.music;
  if (music.mode === "provider" && music.providerName === "Spotify") {
    return (
      <PersonalSpotifyMusicView
        config={config}
        onNavigate={onNavigate}
        onMusicAction={onMusicAction}
        catalogMarket={music.catalogMarket}
        searchEnabled={music.searchEnabled}
        searchResultLimit={music.searchResultLimit}
        t={t}
      />
    );
  }

  return <SimulatedMusicView config={config} onNavigate={onNavigate} t={t} />;
}

type SpotifyPlaybackState =
  | { state: "disabled" }
  | { state: "driver-setup-required" }
  | { state: "not-connected" }
  | {
      state: "ready";
      playback: {
        hasActiveDevice: boolean;
        isPlaying: boolean;
        repeatMode: "off" | "context" | "track" | null;
        track: {
          uri: string | null;
          title: string;
          artist: string;
          album: string | null;
          artworkUrl: string | null;
          durationMs: number | null;
          progressMs: number | null;
        } | null;
      };
    };

const passengerRepeatEnableRetryGate = createPassengerRepeatRetryGate();
const passengerRepeatRestoreRetryGate = createPassengerRepeatRetryGate();

function getPassengerRepeatStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const getSharedPersonalSpotifyPlayback = createSingleFlight(async () => {
  const status = await getPersonalSpotifyPlayback({ data: {} });
  if (status.state !== "ready") return status;

  const storage = getPassengerRepeatStorage();
  const session = readPassengerRepeatSession(storage ?? unavailableStorage);
  const action = decidePassengerRepeatAction(
    session,
    status.playback.track?.uri ?? null,
    status.playback.repeatMode,
  );
  if (action.type === "none") return status;
  if (action.type === "wait") {
    writePassengerRepeatSession(storage ?? unavailableStorage, action.session);
    return status;
  }
  if (action.type === "clear") {
    writePassengerRepeatSession(storage ?? unavailableStorage, null);
    return status;
  }
  const actionSession = action.type === "enable-track" ? action.session : session;
  const retryGate =
    action.type === "enable-track"
      ? passengerRepeatEnableRetryGate
      : passengerRepeatRestoreRetryGate;
  if (actionSession && retryGate.shouldWait(actionSession, Date.now())) {
    return status;
  }

  try {
    const mode = action.type === "enable-track" ? "track" : action.mode;
    if (action.type === "enable-track") {
      writePassengerRepeatSession(storage ?? unavailableStorage, action.session);
    }
    await setPersonalSpotifyRepeatMode({ data: { mode } });
    if (action.type === "enable-track") {
      const latestSession = readPassengerRepeatSession(storage ?? unavailableStorage);
      if (isSamePassengerRepeatSession(latestSession, action.session)) {
        writePassengerRepeatSession(storage ?? unavailableStorage, {
          ...action.session,
          repeatApplied: true,
        });
      }
      passengerRepeatEnableRetryGate.succeeded(action.session);
      return { ...status, playback: { ...status.playback, repeatMode: "track" as const } };
    }
    const latestSession = readPassengerRepeatSession(storage ?? unavailableStorage);
    if (session && isSamePassengerRepeatSession(latestSession, session)) {
      writePassengerRepeatSession(storage ?? unavailableStorage, null);
    }
    if (actionSession) retryGate.succeeded(actionSession);
    return { ...status, playback: { ...status.playback, repeatMode: action.mode } };
  } catch (error) {
    // Repeat is an enhancement: playback polling remains available if Spotify rejects it.
    const latestSession = readPassengerRepeatSession(storage ?? unavailableStorage);
    if (action.type === "enable-track") {
      if (isSamePassengerRepeatSession(latestSession, action.session)) {
        writePassengerRepeatSession(storage ?? unavailableStorage, action.session);
      }
    }
    if (
      actionSession &&
      latestSession &&
      isSamePassengerRepeatSession(latestSession, actionSession)
    ) {
      retryGate.failed(actionSession, Date.now() + 60_000);
    }
    console.warn("[Spotify] Passenger repeat mode could not be updated.", error);
    return status;
  }
});

const unavailableStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

type SpotifySearchTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  explicit: boolean;
};

function formatSpotifyDuration(durationMs: number | null) {
  if (!durationMs || durationMs < 0) return "—";
  const totalSeconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const MUSIC_DISCOVERY_COLLECTIONS = [
  {
    accent: "#E6CE20",
    labelKey: "vibeTopUs",
    playlistId: "37i9dQZEVXbLRQDuF5jeBp",
    query: "spotify top 50 usa",
  },
  {
    accent: "#7ED957",
    labelKey: "vibeTopGlobal",
    playlistId: "37i9dQZEVXbMDoHDwVN2tF",
    query: "spotify top 50 global",
  },
  {
    accent: "#FF6B6B",
    labelKey: "vibeToday",
    playlistId: "37i9dQZF1DXcBWIGoYBM5M",
    query: "today's top hits",
  },
] as const;

function ambientColorFallback(seed: string | null) {
  if (!seed) return "230 206 32";
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  const palette = ["230 206 32", "201 125 255", "79 179 255", "255 140 66", "255 77 109"];
  return palette[Math.abs(hash) % palette.length] ?? "230 206 32";
}

type ArtworkPalette = {
  primary: string;
  secondary: string;
  tertiary: string;
};

const STREEX_YELLOW = "230 206 32";
const VISUALIZER_BLUE = "79 179 255";

function colorSaturation(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue) / 255;
  const minimum = Math.min(red, green, blue) / 255;
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function paletteFallback(seed: string | null): ArtworkPalette {
  const primary = ambientColorFallback(seed);
  return { primary, secondary: STREEX_YELLOW, tertiary: VISUALIZER_BLUE };
}

function useArtworkPalette(artworkUrl: string | null) {
  const [palette, setPalette] = useState<ArtworkPalette>(() => paletteFallback(artworkUrl));

  useEffect(() => {
    const fallback = paletteFallback(artworkUrl);
    if (!artworkUrl) {
      setPalette(fallback);
      return;
    }

    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Map<
          string,
          { red: number; green: number; blue: number; count: number }
        >();
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3] ?? 0;
          const pixelRed = pixels[index] ?? 0;
          const pixelGreen = pixels[index + 1] ?? 0;
          const pixelBlue = pixels[index + 2] ?? 0;
          if (alpha < 180 || pixelRed + pixelGreen + pixelBlue < 45) continue;
          const red = Math.min(255, Math.round(pixelRed / 32) * 32);
          const green = Math.min(255, Math.round(pixelGreen / 32) * 32);
          const blue = Math.min(255, Math.round(pixelBlue / 32) * 32);
          const key = `${red} ${green} ${blue}`;
          const existing = colors.get(key);
          colors.set(key, {
            red,
            green,
            blue,
            count: (existing?.count ?? 0) + 1,
          });
        }
        const ranked = [...colors.values()].sort((left, right) => right.count - left.count);
        if (!ranked.length) throw new Error("No usable pixels");
        const distinct = ranked.reduce<typeof ranked>((picked, color) => {
          const isDistinct = picked.every(
            (candidate) =>
              Math.abs(candidate.red - color.red) +
                Math.abs(candidate.green - color.green) +
                Math.abs(candidate.blue - color.blue) >
              72,
          );
          if (isDistinct && picked.length < 3) picked.push(color);
          return picked;
        }, []);
        const primary = distinct[0] ?? ranked[0];
        const secondary = distinct[1] ?? primary;
        const tertiary = distinct[2] ?? secondary;
        if (!primary || !secondary || !tertiary) throw new Error("No usable palette");
        const isMonochrome = [primary, secondary, tertiary].every(
          (color) => colorSaturation(color.red, color.green, color.blue) < 0.2,
        );
        if (active) {
          const primaryValue = `${primary.red} ${primary.green} ${primary.blue}`;
          setPalette(
            isMonochrome
              ? { primary: primaryValue, secondary: VISUALIZER_BLUE, tertiary: primaryValue }
              : {
                  primary: primaryValue,
                  secondary: `${secondary.red} ${secondary.green} ${secondary.blue}`,
                  tertiary: `${tertiary.red} ${tertiary.green} ${tertiary.blue}`,
                },
          );
        }
      } catch {
        if (active) setPalette(fallback);
      }
    };
    image.onerror = () => {
      if (active) setPalette(fallback);
    };
    image.src = artworkUrl;

    return () => {
      active = false;
    };
  }, [artworkUrl]);

  return palette;
}

function ambientStyle(palette: ArtworkPalette) {
  const saturation = [palette.primary, palette.secondary, palette.tertiary].map((color) => {
    const [red = 0, green = 0, blue = 0] = color.split(" ").map(Number);
    return colorSaturation(red, green, blue);
  });
  const contrastStrength =
    Math.max(...saturation) < 0.2 ? 0.82 : Math.max(...saturation) < 0.42 ? 0.58 : 0.34;

  return {
    "--passenger-ambient-color": palette.primary,
    "--passenger-visualizer-primary": palette.primary,
    "--passenger-visualizer-secondary": palette.secondary,
    "--passenger-visualizer-tertiary": palette.tertiary,
    "--passenger-contrast-strength": String(contrastStrength),
  } as React.CSSProperties;
}

function interpolatePaletteColor(palette: ArtworkPalette, position: number) {
  const stops = [palette.primary, STREEX_YELLOW, palette.secondary, palette.tertiary].map((color) =>
    color.split(" ").map(Number),
  );
  const scaledPosition = Math.max(0, Math.min(1, position)) * (stops.length - 1);
  const leftIndex = Math.floor(scaledPosition);
  const blend = scaledPosition - leftIndex;
  const left = stops[leftIndex] ?? stops[0] ?? [230, 206, 32];
  const right = stops[leftIndex + 1] ?? left;
  return left
    .map((channel, index) => Math.round(channel + ((right[index] ?? channel) - channel) * blend))
    .join(" ");
}

function MusicVisualizer({
  active,
  compact = false,
  palette,
}: {
  active: boolean;
  compact?: boolean;
  palette: ArtworkPalette;
}) {
  const barHeights = [18, 34, 46, 28, 58, 39, 24, 51, 32, 64, 42, 27, 55, 35];
  const barCount = compact ? 28 : 26;
  return (
    <span
      aria-hidden="true"
      className={`passenger-music-visualizer${active ? " passenger-music-visualizer--active" : ""}${
        compact ? " passenger-music-visualizer--compact" : ""
      }`}
    >
      {Array.from({ length: barCount }, (_, index) => {
        const baseHeight = barHeights[index % barHeights.length] ?? 32;
        const stop = index / Math.max(1, barCount - 1);
        const visualizerColor = interpolatePaletteColor(palette, stop);
        return (
          <span
            key={index}
            style={
              {
                "--visualizer-index": index,
                "--visualizer-height": `${compact ? Math.round(baseHeight * 1.55) : baseHeight}px`,
                "--visualizer-color": visualizerColor,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

function SpotifyMarquee({ children, className }: { children: string; className?: string }) {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const itemRef = useRef<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(14);

  useEffect(() => {
    const viewport = viewportRef.current;
    const item = itemRef.current;
    if (!viewport || !item) return;

    const measure = () => {
      const hasOverflow = item.scrollWidth > viewport.clientWidth + 1;
      setOverflows(hasOverflow);
      if (hasOverflow) {
        const travelDistance = item.scrollWidth + 48;
        setDurationSeconds(Math.max(14, Math.min(28, Math.round(travelDistance / 48 + 2))));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(item);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span ref={viewportRef} className={`passenger-idle-marquee ${className ?? ""}`}>
      <span
        className={`passenger-idle-marquee-track${overflows ? " is-active" : ""}`}
        style={
          overflows
            ? ({ "--passenger-marquee-duration": `${durationSeconds}s` } as React.CSSProperties)
            : undefined
        }
      >
        <span ref={itemRef} className="passenger-idle-marquee-item">
          {children}
        </span>
        {overflows ? (
          <span aria-hidden="true" className="passenger-idle-marquee-item">
            {children}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function useInterpolatedSpotifyProgress(
  initialProgressMs: number | null | undefined,
  durationMs: number | null | undefined,
  isPlaying: boolean | undefined,
) {
  const [progressMs, setProgressMs] = useState(initialProgressMs ?? 0);

  useEffect(() => {
    setProgressMs(initialProgressMs ?? 0);
  }, [initialProgressMs, durationMs]);

  useEffect(() => {
    if (!isPlaying || !durationMs) return;
    const interval = window.setInterval(() => {
      setProgressMs((current) => Math.min(current + 1_000, durationMs));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [durationMs, isPlaying]);

  return progressMs;
}

function PersonalSpotifyHomeCard({
  onNavigate,
  pollingEnabled,
  t,
}: {
  onNavigate: (view: View) => void;
  pollingEnabled: boolean;
  t: (typeof copy)[Language];
}) {
  const [status, setStatus] = useState<SpotifyPlaybackState | null>(null);

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      try {
        const next = await getSharedPersonalSpotifyPlayback();
        if (isMounted) setStatus(next);
      } catch {
        // The detailed recovery state stays in Music; Home remains a safe entry point.
        if (isMounted) setStatus(null);
      }
    };

    const stopPolling = startSpotifyPolling({
      refresh,
      intervalMs: 30_000,
      enabled: pollingEnabled,
    });
    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [pollingEnabled]);

  const playback = status?.state === "ready" ? status.playback : null;
  const track = playback?.track ?? null;
  const hasActiveDevice = playback?.hasActiveDevice ?? false;

  return (
    <button
      type="button"
      onClick={() => onNavigate("music")}
      className="group relative flex min-h-[174px] w-full min-w-0 items-center gap-5 overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-[#E6CE20]/[0.09] p-5 text-left transition hover:border-[#E6CE20]/35 hover:bg-white/[0.07]"
    >
      <span className="absolute -right-14 -top-20 h-48 w-48 rounded-full bg-[#E6CE20]/10 blur-3xl" />
      {track?.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt=""
          className="relative h-24 w-24 shrink-0 rounded-[22px] object-cover shadow-xl"
        />
      ) : (
        <span className="relative grid h-24 w-24 shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-[#E6CE20] to-amber-600 text-black shadow-xl">
          <Music2 className="h-9 w-9" />
        </span>
      )}
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
          {t.nowPlaying}
        </span>
        <span className="mt-2 block truncate text-xl font-black tracking-tight">
          {track?.title ?? t.chooseMusic}
        </span>
        <span className="mt-1 block truncate text-sm text-white/60">
          {track ? `${track.artist}${track.album ? ` · ${track.album}` : ""}` : t.spotifyNoDevice}
        </span>
        <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {t.spotifyDevice}: {hasActiveDevice ? t.spotifyActive : "—"}
        </span>
      </span>
      <span className="relative flex shrink-0 items-center gap-2 rounded-2xl border border-[#E6CE20]/40 bg-[#E6CE20]/12 px-4 py-3 text-right text-[#E6CE20] transition group-hover:bg-[#E6CE20]/18">
        <span className="hidden max-w-36 text-xs leading-tight sm:block">
          <span className="block font-semibold">{t.chooseMusic}</span>
          <span className="mt-0.5 block text-[10px] text-white/55">{t.musicHint}</span>
        </span>
        <span className="text-xs font-semibold sm:hidden">{t.chooseMusic}</span>
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function PersonalSpotifyMusicView({
  config,
  catalogMarket,
  onNavigate,
  onMusicAction,
  searchEnabled,
  searchResultLimit,
  t,
}: {
  config: AppConfig;
  catalogMarket: string;
  onNavigate: (view: View) => void;
  onMusicAction: (action: "play" | "pause" | "next" | "search" | "top_50" | "vibes") => void;
  searchEnabled: boolean;
  searchResultLimit: number;
  t: (typeof copy)[Language];
}) {
  const [status, setStatus] = useState<SpotifyPlaybackState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchTrack[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [playlistArtwork, setPlaylistArtwork] = useState<Record<string, string | null>>({});

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        const next = await getSharedPersonalSpotifyPlayback();
        setStatus(next);
        return next;
      } catch (requestError) {
        if (!silent) {
          setError(requestError instanceof Error ? requestError.message : t.spotifyControlError);
        }
        return null;
      }
    },
    [t.spotifyControlError],
  );

  useEffect(() => {
    return startSpotifyPolling({
      refresh: () => refresh(true),
      intervalMs: 5_000,
      refreshOnlyWhenVisible: true,
    });
  }, [refresh]);

  useEffect(() => {
    if (status?.state !== "ready") return;
    let active = true;
    void getPersonalSpotifyPlaylistArtwork({ data: {} })
      .then((response) => {
        if (active) {
          setPlaylistArtwork(
            Object.fromEntries(
              response.playlists.map((playlist) => [playlist.id, playlist.artworkUrl]),
            ),
          );
        }
      })
      .catch(() => {
        // Covers are optional: Spotify playback and search must remain independent.
      });
    return () => {
      active = false;
    };
  }, [status?.state]);

  const trackKey = (playbackStatus: SpotifyPlaybackState | null) => {
    if (playbackStatus?.state !== "ready" || !playbackStatus.playback.track) return null;
    const { artist, title } = playbackStatus.playback.track;
    return `${artist}\u0000${title}`;
  };

  const refreshUntilTrackChanges = async (previousTrackKey: string | null) => {
    for (const delay of [500, 800, 1_200]) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const next = await refresh(true);
      const nextTrackKey = trackKey(next);
      if (nextTrackKey && nextTrackKey !== previousTrackKey) return;
    }
  };

  const control = async (command: "play" | "pause" | "next") => {
    setBusy(true);
    setError(null);
    try {
      const previousTrackKey = trackKey(status);
      await controlPersonalSpotifyPlayback({ data: { command } });
      onMusicAction(command);
      if (command === "next") {
        await refreshUntilTrackChanges(previousTrackKey);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await refresh();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.spotifyControlError);
    } finally {
      setBusy(false);
    }
  };

  const searchTracks = async (rawQuery: string) => {
    const normalizedQuery = rawQuery.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearchMessage(t.searchMinLength);
      return;
    }

    setSearching(true);
    setError(null);
    setSearchMessage(null);
    try {
      const response = await searchPersonalSpotifyTracks({
        data: { query: normalizedQuery, limit: searchResultLimit, market: catalogMarket },
      });
      setResults(response.tracks);
      onMusicAction("search");
      setSearchMessage(response.tracks.length ? null : t.searchEmpty);
    } catch (requestError) {
      setResults([]);
      setError(requestError instanceof Error ? requestError.message : t.spotifyControlError);
    } finally {
      setSearching(false);
    }
  };

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void searchTracks(query);
  };

  const searchVibe = (vibe: string) => {
    setQuery(vibe);
    void searchTracks(vibe);
  };

  const playTrack = async (uri: string) => {
    setBusy(true);
    setError(null);
    const storage = getPassengerRepeatStorage() ?? unavailableStorage;
    const previousRepeatSession = readPassengerRepeatSession(storage);
    const nextRepeatSession = createPassengerRepeatSession(
      uri,
      status?.state === "ready" ? (status.playback.track?.uri ?? null) : null,
      previousRepeatSession?.originalRepeatMode ??
        (status?.state === "ready" ? status.playback.repeatMode : null) ??
        "off",
    );
    writePassengerRepeatSession(storage, nextRepeatSession);
    passengerRepeatEnableRetryGate.succeeded(nextRepeatSession);
    try {
      const previousTrackKey = trackKey(status);
      await playPersonalSpotifyTrack({ data: { uri } });
      onMusicAction("play");
      await refreshUntilTrackChanges(previousTrackKey);
    } catch (requestError) {
      if (isSamePassengerRepeatSession(readPassengerRepeatSession(storage), nextRepeatSession)) {
        writePassengerRepeatSession(storage, previousRepeatSession);
      }
      setError(requestError instanceof Error ? requestError.message : t.spotifyControlError);
    } finally {
      setBusy(false);
    }
  };

  const isMusicUnavailable = status?.state === "disabled";
  const message = isMusicUnavailable
    ? t.musicUnavailableDescription
    : status?.state === "driver-setup-required" || status?.state === "not-connected"
      ? t.musicGettingReadyDescription
      : null;
  const playback = status?.state === "ready" ? status.playback : null;
  const liveProgressMs = useInterpolatedSpotifyProgress(
    playback?.track?.progressMs,
    playback?.track?.durationMs,
    playback?.isPlaying,
  );
  const trackProgress = playback?.track?.durationMs
    ? Math.min(100, Math.max(0, (liveProgressMs / playback.track.durationMs) * 100))
    : null;
  const artworkPalette = useArtworkPalette(playback?.track?.artworkUrl ?? null);

  return (
    <div
      className="passenger-music-layout passenger-sound-lounge flex flex-col gap-5"
      style={ambientStyle(artworkPalette)}
    >
      <div className="passenger-music-header">
        <ViewHeader eyebrow={t.musicEyebrow} title={t.musicTitle} description={t.musicSubtitle} />
      </div>
      {message ? (
        <section className="passenger-music-playback passenger-music-now-playing flex min-h-[312px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-[#E6CE20]/[0.13] p-6 text-center">
          <span className="grid h-28 w-28 place-items-center rounded-[26px] bg-gradient-to-br from-[#E6CE20] to-amber-600 text-black shadow-2xl">
            <Music2 className="h-10 w-10" />
          </span>
          <p className="mt-5 text-xl font-black tracking-tight">
            {isMusicUnavailable ? t.musicUnavailableTitle : t.musicGettingReady}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">{message}</p>
        </section>
      ) : playback ? (
        <section className="passenger-music-playback passenger-music-now-playing passenger-music-now-playing-ready relative flex min-h-[286px] items-center gap-6 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.04] to-[#E6CE20]/[0.13] p-7 text-left">
          <span className="passenger-music-ambient-orb absolute -right-14 -top-20 h-56 w-56 rounded-full blur-3xl" />
          <span aria-hidden="true" className="passenger-music-stage-lights">
            <span className="passenger-music-stage-light passenger-music-stage-light--one" />
            <span className="passenger-music-stage-light passenger-music-stage-light--two" />
            <span className="passenger-music-stage-light passenger-music-stage-light--three" />
            <span className="passenger-music-stage-light passenger-music-stage-light--four" />
          </span>
          <div className="passenger-music-player-header relative min-w-0">
            <div className="min-w-0">
              <p className="passenger-music-now-playing-eyebrow text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
                {t.nowPlaying}
              </p>
              <SpotifyMarquee className="passenger-music-track-title mt-2 font-black leading-[1.04] tracking-tight">
                {playback.track?.title ?? t.chooseMusic}
              </SpotifyMarquee>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="passenger-music-refresh grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 disabled:opacity-45"
              aria-label={t.spotifyRefresh}
              title={t.spotifyRefresh}
            >
              <RefreshCw className={`h-4 w-4${busy ? " animate-spin" : ""}`} />
            </button>
          </div>
          <div className="passenger-music-player-body relative flex min-h-0 min-w-0 items-center gap-6">
            {playback.track?.artworkUrl ? (
              <img
                src={playback.track.artworkUrl}
                alt=""
                className="passenger-music-now-playing-art h-52 w-52 shrink-0 rounded-[28px] object-cover shadow-2xl"
              />
            ) : (
              <div className="passenger-music-now-playing-art h-52 w-52 shrink-0 rounded-[28px] bg-gradient-to-br from-[#E6CE20] via-amber-500 to-orange-700 shadow-2xl" />
            )}
            <div className="passenger-music-now-playing-copy passenger-music-player-details flex min-w-0 flex-1 flex-col justify-center self-stretch">
              <p className="passenger-music-track-artist mt-4 text-sm leading-snug text-white/75">
                {playback.track?.artist ?? t.spotifyNoDevice}
              </p>
              {playback.track?.album && (
                <p className="passenger-music-track-album mt-1 text-xs leading-snug text-white/50">
                  {playback.track.album}
                </p>
              )}
              {playback.track ? (
                <>
                  <p className="passenger-music-playing-status mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E6CE20]">
                    {playback.isPlaying ? t.spotifyPlaying : t.spotifyPaused}
                  </p>
                  {trackProgress !== null && (
                    <div
                      className="passenger-music-progress mt-3 max-w-md"
                      aria-label={`${formatSpotifyDuration(liveProgressMs)} of ${formatSpotifyDuration(playback.track.durationMs)}`}
                    >
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#E6CE20] transition-[width] duration-500"
                          style={{ width: `${trackProgress}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] font-medium text-white/45">
                        <span>{formatSpotifyDuration(liveProgressMs)}</span>
                        <span>{formatSpotifyDuration(playback.track.durationMs)}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 rounded-xl border border-[#E6CE20]/20 bg-[#E6CE20]/[0.06] px-3 py-2.5">
                  <p className="text-sm font-semibold text-white">{t.spotifyNoTrackTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    {t.spotifyNoTrackDescription}
                  </p>
                </div>
              )}
              <div className="passenger-music-controls mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={busy || !playback.hasActiveDevice}
                  onClick={() => void control(playback.isPlaying ? "pause" : "play")}
                  className="grid h-12 w-12 place-items-center rounded-full bg-[#E6CE20] text-black disabled:opacity-45"
                  aria-label={playback.isPlaying ? "Pause" : "Play"}
                >
                  {playback.isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy || !playback.hasActiveDevice}
                  onClick={() => void control("next")}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/15 disabled:opacity-45"
                  aria-label="Next"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          <MusicVisualizer active={Boolean(playback.isPlaying)} palette={artworkPalette} />
        </section>
      ) : (
        <section className="passenger-music-playback passenger-music-now-playing flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.05] p-5 text-sm text-white/60">
          <Music2 className="h-10 w-10 text-[#E6CE20]" />
          <p className="mt-4">{t.spotifyRefresh}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="passenger-music-refresh mt-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 font-semibold text-white/75 disabled:opacity-45"
          >
            <RefreshCw className={`h-4 w-4${busy ? " animate-spin" : ""}`} />
            {t.spotifyRefresh}
          </button>
        </section>
      )}
      {error && <p className="passenger-music-error text-sm text-red-300">{error}</p>}
      {searchEnabled && (
        <section className="passenger-music-search rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
          <div className="passenger-music-search-heading">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
              {t.searchSpotify}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{t.searchSpotifyHint}</p>
          </div>
          <div className="passenger-music-vibes mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {t.exploreMusic}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUSIC_VIBES.map((vibe) => {
                const Icon = vibe.icon;
                return (
                  <button
                    key={vibe.query}
                    type="button"
                    disabled={searching}
                    onClick={() => searchVibe(vibe.query)}
                    className="passenger-music-vibe inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-45"
                    style={{ "--vibe-accent": vibe.accent } as React.CSSProperties}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t[vibe.labelKey]}
                  </button>
                );
              })}
            </div>
          </div>
          <form
            className="passenger-music-search-form mt-4 flex gap-2"
            onSubmit={(event) => void search(event)}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={100}
              placeholder={t.search}
              aria-label={t.searchSpotify}
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#E6CE20]/70"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-2xl bg-[#E6CE20] px-4 text-sm font-bold text-black disabled:opacity-45"
            >
              {searching ? "…" : t.searchButton}
            </button>
          </form>
          {searchMessage && (
            <p className="passenger-music-search-message mt-3 text-sm text-white/55">
              {searchMessage}
            </p>
          )}
          {!searchMessage && results.length === 0 && (
            <div className="passenger-music-collections mt-5">
              <div className="mt-3 grid gap-3">
                {MUSIC_DISCOVERY_COLLECTIONS.map((collection) => {
                  const artworkUrl = playlistArtwork[collection.playlistId];
                  return (
                    <button
                      key={collection.query}
                      type="button"
                      disabled={searching}
                      onClick={() => searchVibe(collection.query)}
                      className="passenger-music-collection passenger-music-playlist-card group relative flex min-h-[8rem] overflow-hidden rounded-2xl border p-4 text-left transition disabled:opacity-45"
                      style={
                        {
                          "--collection-accent": collection.accent,
                        } as React.CSSProperties
                      }
                    >
                      {artworkUrl ? (
                        <img
                          src={artworkUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <span className="passenger-music-playlist-card__overlay absolute inset-0" />
                      <span className="relative z-10 mt-auto min-w-0 pr-8 text-base font-black text-white">
                        {t[collection.labelKey]}
                      </span>
                      <ChevronRight className="passenger-music-playlist-chevron absolute bottom-4 right-4 z-10 h-5 w-5 text-white/70 transition group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {results.length > 0 && (
            <div className="passenger-music-results-block mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {t.searchResults}
              </p>
              <div className="passenger-music-results overflow-y-auto rounded-2xl border border-white/10">
                {results.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    disabled={busy || !playback?.hasActiveDevice}
                    onClick={() => void playTrack(track.uri)}
                    className="flex w-full items-center gap-3 border-b border-white/10 bg-black/10 p-3 text-left last:border-b-0 hover:bg-white/[0.05] disabled:opacity-45"
                    aria-label={`${t.playSong}: ${track.title}`}
                  >
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E6CE20]/15 text-[#E6CE20]">
                        <Music2 className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{track.title}</span>
                      <span className="block truncate text-xs text-white/55">
                        {track.artist}
                        {track.album ? ` · ${track.album}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[#E6CE20]">
                      <span className="text-[10px] font-semibold text-white/45">
                        {formatSpotifyDuration(track.durationMs)}
                      </span>
                      {track.explicit && (
                        <span className="text-[9px] font-bold uppercase">{t.explicit}</span>
                      )}
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SimulatedMusicView({
  config,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  const [query, setQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MUSIC_LIBRARY;
    return MUSIC_LIBRARY.filter((track) =>
      `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const current = MUSIC_LIBRARY[currentIndex];

  return (
    <div className="flex flex-col gap-5">
      <ViewHeader eyebrow={t.preview} title={t.musicTitle} description={t.musicSubtitle} />
      <section className="flex items-center gap-4 rounded-[26px] border border-white/10 bg-white/[0.05] p-5">
        <div className="h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br from-[#E6CE20] via-amber-500 to-orange-700" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6CE20]">
            {t.nowPlaying}
          </p>
          <p className="mt-1 truncate text-lg font-bold">{current.title}</p>
          <p className="truncate text-sm text-white/55">
            {current.artist} · {current.album}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/5 rounded-full bg-[#E6CE20]" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            className="grid h-12 w-12 place-items-center rounded-full bg-[#E6CE20] text-black"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => (index + 1) % MUSIC_LIBRARY.length)}
            className="grid h-12 w-12 place-items-center rounded-full border border-white/15"
            aria-label="Next"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </section>
      <label className="relative block">
        <span className="sr-only">{t.search}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search}
          className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-12 pr-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#E6CE20]/60"
        />
      </label>
      <section className="passenger-music-results-block">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {t.results}
        </p>
        <div className="passenger-music-results overflow-y-auto rounded-[24px] border border-white/10 bg-white/[0.03]">
          {results.map((track) => {
            const index = MUSIC_LIBRARY.indexOf(track);
            return (
              <button
                key={track.title}
                type="button"
                onClick={() => {
                  setCurrentIndex(index);
                  setIsPlaying(true);
                }}
                className={`flex min-h-[70px] w-full items-center gap-3 border-b border-white/5 px-4 text-left last:border-none ${index === currentIndex ? "bg-[#E6CE20]/10" : "hover:bg-white/[0.04]"}`}
              >
                <span className="w-5 text-right text-xs text-white/45">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{track.title}</span>
                  <span className="block truncate text-sm text-white/55">
                    {track.artist} · {track.album}
                  </span>
                </span>
                <span className="text-sm text-white/45">{track.duration}</span>
              </button>
            );
          })}
        </div>
      </section>
      <button
        type="button"
        onClick={() => onNavigate("home")}
        className="w-fit text-sm text-white/55 underline underline-offset-4"
      >
        {t.home}
      </button>
    </div>
  );
}

function GamesView({
  language,
  onGameCompleted,
  onGameOpened,
  onGameStarted,
  t,
  thisOrThatEnabled,
  onRequestedGameConsumed,
  requestedGame,
  utahHigherOrLowerEnabled,
  utahTriviaEnabled,
  phoneContinuation,
}: {
  language: Language;
  onGameCompleted: (game: PassengerGame) => void;
  onGameOpened: (game: PassengerGame) => void;
  onGameStarted: (game: PassengerGame) => void;
  t: (typeof copy)[Language];
  thisOrThatEnabled: boolean;
  onRequestedGameConsumed: () => void;
  requestedGame: PassengerGame | null;
  utahHigherOrLowerEnabled: boolean;
  utahTriviaEnabled: boolean;
  phoneContinuation: string | null;
}) {
  const [activeGame, setActiveGame] = useState<PassengerGame | null>(null);

  useEffect(() => {
    if (!requestedGame) return;
    setActiveGame(requestedGame);
    onRequestedGameConsumed();
  }, [onRequestedGameConsumed, requestedGame]);

  if (activeGame === "trivia" && utahTriviaEnabled) {
    return (
      <UtahTrivia
        language={language}
        onComplete={() => onGameCompleted("trivia")}
        onExit={() => setActiveGame(null)}
        onStart={() => onGameStarted("trivia")}
      />
    );
  }

  if (activeGame === "choice" && thisOrThatEnabled) {
    return (
      <ThisOrThat
        language={language}
        onComplete={() => onGameCompleted("choice")}
        onExit={() => setActiveGame(null)}
        onStart={() => onGameStarted("choice")}
      />
    );
  }

  if (activeGame === "higher-lower" && utahHigherOrLowerEnabled) {
    return (
      <UtahHigherOrLower
        language={language}
        onComplete={() => onGameCompleted("higher-lower")}
        onExit={() => setActiveGame(null)}
        onStart={() => onGameStarted("higher-lower")}
      />
    );
  }

  return (
    <div className="passenger-games-layout flex flex-1 flex-col gap-5">
      <div className="passenger-games-header">
        <ViewHeader eyebrow={t.gamesEyebrow} title={t.gamesTitle} description={t.gamesSubtitle} />
      </div>
      <div className="passenger-games-grid passenger-games-grid--three grid flex-1 grid-cols-2 gap-4">
        <GameCard
          kind="trivia"
          title={t.utahTrivia}
          description={t.utahTriviaDescription}
          previewLabel={t.triviaPreview}
          icon={<HoneycombMark />}
          onClick={
            utahTriviaEnabled
              ? () => {
                  onGameOpened("trivia");
                  setActiveGame("trivia");
                }
              : undefined
          }
          status={utahTriviaEnabled ? t.playNow : t.comingSoon}
        />
        <GameCard
          kind="choice"
          title={t.thisOrThat}
          description={t.thisOrThatDescription}
          previewLabel={t.choicePreview}
          choiceLabels={[t.choiceFirst, t.choiceSecond]}
          icon={<ArrowLeftRight className="h-7 w-7" />}
          onClick={
            thisOrThatEnabled
              ? () => {
                  onGameOpened("choice");
                  setActiveGame("choice");
                }
              : undefined
          }
          status={thisOrThatEnabled ? t.playNow : t.comingSoon}
        />
        <GameCard
          kind="higher-lower"
          title={t.utahHigherOrLower}
          description={t.utahHigherOrLowerDescription}
          previewLabel={t.higherOrLowerPreview}
          icon={<ArrowUpDown className="h-7 w-7" />}
          onClick={
            utahHigherOrLowerEnabled
              ? () => {
                  onGameOpened("higher-lower");
                  setActiveGame("higher-lower");
                }
              : undefined
          }
          status={utahHigherOrLowerEnabled ? t.playNow : t.comingSoon}
        />
      </div>
      <div className="passenger-games-coming-soon-grid grid gap-4">
        <section className="passenger-games-horizon relative aspect-[1200/509] overflow-hidden rounded-[26px] border border-[#E6CE20]/30 shadow-[0_16px_45px_rgba(0,0,0,0.22)]">
          <img
            src={horizonQuickActionCard}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
          <div className="relative flex h-full flex-col justify-end p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#E6CE20]">
              {t.comingSoon}
            </p>
            <p className="mt-2 text-xl font-black tracking-tight text-white">{t.horizonTitle}</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-white/70">
              {t.horizonTabletDescription}
            </p>
          </div>
        </section>
        <section
          data-testid="streex-horizon-phone-card"
          className="flex aspect-[1200/509] items-center gap-4 overflow-hidden rounded-[26px] border border-white/10 bg-[#151515] p-5 shadow-[0_16px_45px_rgba(0,0,0,0.22)]"
        >
          <span className="shrink-0 rounded-xl bg-white p-2">
            <QRCodeSVG
              value={phoneContinuation ?? "https://rides.getstreex.com"}
              size={112}
              bgColor="#FFFFFF"
              fgColor="#0B0B0B"
              level="M"
            />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <QrCode className="h-4 w-4 shrink-0 text-[#E6CE20]" />
              {t.horizonPhoneTitle}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-white/55">
              {t.horizonPhoneDescription}
            </span>
          </span>
        </section>
      </div>
    </div>
  );
}

function GameCard({
  description,
  icon,
  kind,
  previewLabel,
  choiceLabels,
  onClick,
  status,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  kind: "trivia" | "choice" | "higher-lower";
  previewLabel: string;
  choiceLabels?: [string, string];
  onClick?: () => void;
  status: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`passenger-game-card passenger-game-card--${kind}`}
    >
      <div className="passenger-game-card-art" aria-hidden="true">
        {kind === "trivia" ? (
          <>
            <img src={utahTriviaSymbols} alt="" className="passenger-game-card-art-image" />
            <span className="passenger-game-card-art-shade passenger-game-card-art-shade--trivia" />
            <span className="passenger-game-card-trivia-stamp">UT</span>
          </>
        ) : kind === "choice" ? (
          <div className="passenger-game-card-choice-split">
            {THIS_OR_THAT_TRAILER_VISUALS.slice(0, 2).map((visual, index) => (
              <span key={visual.src} className="passenger-game-card-choice-panel">
                <img src={visual.src} alt="" style={{ objectPosition: visual.objectPosition }} />
                <span
                  className={`passenger-game-card-choice-shade passenger-game-card-choice-shade--${index + 1}`}
                />
              </span>
            ))}
            <span className="passenger-game-card-or">OR</span>
          </div>
        ) : (
          <div className="passenger-game-card-higher-lower-split">
            <span className="passenger-game-card-higher-lower-panel">
              <img src={utahTriviaAtlas} alt="" />
            </span>
            <span className="passenger-game-card-higher-lower-panel">
              <img src={utahTriviaNationalParks} alt="" />
            </span>
            <span className="passenger-game-card-higher-lower-or">↑↓</span>
          </div>
        )}
      </div>
      <div className="passenger-game-card-content">
        <span className="passenger-game-card-icon">{icon}</span>
        <div className="passenger-game-card-copy">
          <p className="passenger-game-card-preview">
            {kind === "trivia" ? "10 QUESTIONS · UTAH EDITION" : previewLabel}
          </p>
          <p className="passenger-game-card-title">{title}</p>
          <p className="passenger-game-card-description">{description}</p>
          {kind === "choice" && (
            <span className="passenger-game-card-choice-words">
              {choiceLabels?.[0] ?? "THIS"} <span>·</span> {choiceLabels?.[1] ?? "THAT"}
            </span>
          )}
        </div>
        <span className="passenger-game-card-status">{status}</span>
      </div>
    </button>
  );
}

function StreexView({
  config,
  onBookRide,
  onNavigate,
  phoneContinuation,
  t,
}: {
  config: AppConfig;
  onBookRide: () => void;
  onNavigate: (view: View) => void;
  phoneContinuation: string | null;
  t: (typeof copy)[Language];
}) {
  return (
    <div className="passenger-streex-layout flex flex-col gap-5">
      <section className="passenger-streex-overview flex flex-col gap-5">
        <div className="passenger-streex-header">
          <ViewHeader
            eyebrow={t.streexDifference}
            title={t.streexTitle}
            description={t.streexSubtitle}
          />
        </div>
        <div className="passenger-streex-actions grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <ActionButton
              accent
              icon={<HandCoins />}
              label={t.tip}
              onClick={() => onNavigate("tip")}
            />
          </div>
          <ActionButton icon={<Menu />} label={t.services} onClick={() => onNavigate("services")} />
          <ActionButton icon={<Phone />} label={t.contact} onClick={() => onNavigate("contact")} />
          <ActionButton icon={<Star />} label={t.reviews} onClick={() => onNavigate("reviews")} />
          <ActionButton
            icon={<MapPin />}
            label={t.whereWeRide}
            onClick={() => onNavigate("where-we-ride")}
          />
          <ActionButton accent icon={<CalendarPlus />} label={t.bookRide} onClick={onBookRide} />
          <MeetJuanAction
            config={config}
            label={t.meetJuan}
            onClick={() => onNavigate("meet-juan")}
            subtitle={configOwnerLine(t)}
          />
          <PhoneContinuationCard
            description={t.continuePhoneDescription}
            href={phoneContinuation}
            label={t.continuePhone}
            unavailable={t.unavailable}
          />
        </div>
      </section>
      <div className="passenger-streex-experience">
        <PassengerVehicleGrid title={t.yourRideGallery} />
      </div>
    </div>
  );
}

function PassengerVehicleGrid({ title }: { title: string }) {
  const vehicles = [
    {
      alt: "Silver Toyota RAV4, front three-quarter view",
      image: passengerRav4Front,
      position: "object-center",
    },
    {
      alt: "Silver Toyota RAV4, rear view on a snowy Park City street",
      image: passengerRav4Rear,
      position: "object-center",
    },
    {
      alt: "Silver Toyota RAV4 in Deer Valley snow",
      image: passengerRav4Snow,
      position: "object-center",
    },
    {
      alt: "Silver Toyota RAV4 at the Utah State Capitol",
      image: passengerRav4Side,
      position: "object-center",
    },
  ];

  return (
    <section className="passenger-vehicle-grid-section">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <span className="text-xs font-semibold text-[#E6CE20]">Toyota RAV4</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.image}
            className={`passenger-vehicle-tile relative aspect-[0.9] min-h-[168px] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] ${vehicle.image === passengerRav4Snow ? "passenger-vehicle-tile--snow" : ""}`}
          >
            <img
              src={vehicle.image}
              alt={vehicle.alt}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover ${vehicle.position}`}
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Toyota RAV4
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PassengerBackButton({
  onNavigate,
  t,
}: {
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate("streex")}
      className="flex w-fit items-center gap-2 text-sm text-white/55 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" /> {t.back}
    </button>
  );
}

function WhereWeRideView({
  config,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  return (
    <div className="passenger-subview passenger-areas-layout flex flex-col gap-5">
      <div className="passenger-subview-intro passenger-subview-intro--where-we-ride flex flex-col gap-5">
        <PassengerBackButton onNavigate={onNavigate} t={t} />
        <ViewHeader
          eyebrow={t.streex}
          preserveEyebrowCase
          title={t.whereWeRide}
          description={t.whereWeRideDescription}
        />
      </div>
      <div className="passenger-areas-content min-h-0">
        <ServiceAreas
          config={config}
          equalHeight
          showLinks={false}
          copy={{
            eyebrow: t.whereWeRide,
            title: t.whereWeRideTitle,
            description: t.whereWeRideDescription,
            serviceArea: t.serviceArea,
            moreDestinations: t.moreDestinations,
            extendedRides: t.extendedRides,
          }}
        />
        <div className="passenger-destination-carousel-wrap">
          <ExperienceGallery
            autoScroll
            config={config}
            excludeVehicle
            title={t.streexExperienceTitle}
          />
        </div>
      </div>
    </div>
  );
}

function ServicesView({
  config,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  return (
    <div className="passenger-subview passenger-services-layout flex flex-col gap-5">
      <div className="passenger-subview-intro flex flex-col gap-5">
        <PassengerBackButton onNavigate={onNavigate} t={t} />
        <ViewHeader
          eyebrow={t.streex}
          preserveEyebrowCase
          title={t.services}
          description={t.servicesTitle}
        />
      </div>
      <div className="passenger-services-content min-h-0">
        <ServicesSection className="mt-0 px-0" config={config} title={t.services} />
        <div className="passenger-services-ticker overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.025]">
          <ServiceTicker config={config} />
        </div>
      </div>
    </div>
  );
}

function buildPassengerContactVcard(config: AppConfig) {
  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const website = config.website.trim();
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(config.ownerName)}`,
    `ORG:${escape(config.brandName)}`,
    config.phone ? `TEL;TYPE=CELL:${escape(config.phone)}` : "",
    config.email ? `EMAIL;TYPE=INTERNET:${escape(config.email)}` : "",
    website ? `URL:${escape(website)}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

function ContactView({
  config,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  const contactVcard = buildPassengerContactVcard(config);
  const contactVcardUrl = `data:text/vcard;charset=utf-8,${encodeURIComponent(contactVcard)}`;
  const details = [
    { icon: <Phone />, label: t.phoneAndText, detail: config.phoneDisplay },
    { icon: <MessageCircle />, label: t.whatsapp, detail: config.phoneDisplay },
    { icon: <Mail />, label: t.email, detail: config.email },
    { icon: <Globe2 />, label: t.website, detail: config.website.replace(/^https?:\/\//, "") },
  ].filter((item) => Boolean(item.detail));

  return (
    <div className="passenger-subview passenger-contact-layout flex flex-col gap-5">
      <div className="passenger-subview-intro flex flex-col gap-5">
        <PassengerBackButton onNavigate={onNavigate} t={t} />
        <ViewHeader
          eyebrow={t.streex}
          preserveEyebrowCase
          title={t.contactTitle}
          description={t.contactSubtitle}
        />
      </div>
      <div className="passenger-contact-actions grid gap-3 sm:grid-cols-2">
        {details.map((item) => (
          <div
            key={item.label}
            className="flex min-h-[118px] items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E6CE20]/15 text-[#E6CE20]">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{item.label}</span>
              <span className="mt-1 block text-sm text-white/65">{item.detail}</span>
            </span>
          </div>
        ))}
        <p className="rounded-[18px] border border-[#E6CE20]/20 bg-[#E6CE20]/[0.06] px-4 py-3 text-sm text-white/55 sm:col-span-2">
          {t.contactNote}
        </p>
        <section className="passenger-contact-save flex items-center gap-5 rounded-[22px] border border-[#E6CE20]/25 bg-gradient-to-r from-[#E6CE20]/[0.08] via-white/[0.04] to-white/[0.02] p-4 sm:col-span-2">
          <span className="shrink-0 rounded-2xl bg-white p-2">
            <QRCodeSVG
              /* Encode the vCard payload itself so phone cameras offer the
               * native “Add contact” flow instead of treating the QR as a
               * data: URL to open in a browser. */
              value={contactVcard}
              size={136}
              bgColor="#FFFFFF"
              fgColor="#0B0B0B"
              level="M"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{t.contactSaveTitle}</span>
            <span className="mt-1 block text-sm leading-relaxed text-white/60">
              {t.contactSaveDescription}
            </span>
            <a
              href={contactVcardUrl}
              download="Juan-Streex-Rides.vcf"
              className="mt-3 inline-flex text-sm font-semibold text-[#E6CE20] underline underline-offset-4"
            >
              {t.contactSaveDownload}
            </a>
          </span>
        </section>
      </div>
    </div>
  );
}

function ReviewsView({
  language,
  onNavigate,
  reviews,
  t,
}: {
  language: Language;
  onNavigate: (view: View) => void;
  reviews: PassengerReview[];
  t: (typeof copy)[Language];
}) {
  return (
    <div className="passenger-subview passenger-review-layout flex flex-col gap-5">
      <div className="passenger-subview-intro flex flex-col gap-5">
        <PassengerBackButton onNavigate={onNavigate} t={t} />
        <ViewHeader
          eyebrow={t.streex}
          preserveEyebrowCase
          title={t.reviewTitle}
          description={t.reviewSubtitle}
        />
      </div>
      <div className="passenger-review-content passenger-review-split grid min-h-0 gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <FeedbackForm compact language={language} />
        </div>
        <PassengerReviewRail reviews={reviews} t={t} />
      </div>
    </div>
  );
}

function PassengerReviewRail({
  reviews,
  t,
}: {
  reviews: PassengerReview[];
  t: (typeof copy)[Language];
}) {
  return (
    <section className="passenger-review-rail min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E6CE20]">
            {t.guestNotesEyebrow}
          </p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">{t.guestNotesTitle}</h2>
        </div>
        {reviews.length > 0 && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
            {reviews.length} {languageLabel(t)}
          </span>
        )}
      </div>
      {reviews.length > 0 ? (
        <div className="passenger-review-rail-list mt-5 grid min-h-0 gap-3 overflow-y-auto pr-1">
          {reviews.map((review) => (
            <PassengerReviewCard key={`${review.name}-${review.text}`} review={review} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-relaxed text-white/55">
          {t.noApprovedReviews}
        </p>
      )}
    </section>
  );
}

function languageLabel(t: (typeof copy)[Language]) {
  return t === copy.es ? "reseñas" : "reviews";
}

function TipView({
  config,
  onNavigate,
  t,
}: {
  config: AppConfig;
  onNavigate: (view: View) => void;
  t: (typeof copy)[Language];
}) {
  const paymentMethods = [
    {
      id: "venmo",
      label: t.venmo,
      detail: `@${config.venmo.split("/").filter(Boolean).at(-1) ?? "STREEX"}`,
      href: config.venmo,
      icon: <span className="text-xl font-black italic">V</span>,
    },
    {
      id: "cashapp",
      label: t.cashApp,
      detail: config.cashapp.split("/").filter(Boolean).at(-1) ?? "$STREEX",
      href: config.cashapp,
      icon: <span className="text-xl font-black">$</span>,
    },
    {
      id: "stripe",
      label: t.cardAndWallet,
      detail: config.passengerConsole.links.stripeTip ? t.stripeDetail : t.stripePending,
      href: config.passengerConsole.links.stripeTip,
      icon: <CreditCard className="h-5 w-5" />,
    },
  ] as const;
  const firstAvailableMethod = paymentMethods.find((method) => method.href) ?? paymentMethods[0];
  const [selectedMethodId, setSelectedMethodId] = useState(firstAvailableMethod.id);
  const selectedMethod =
    paymentMethods.find((method) => method.id === selectedMethodId && method.href) ??
    firstAvailableMethod;

  return (
    <div className="passenger-subview passenger-tip-layout flex flex-col gap-5">
      <div className="passenger-subview-intro flex flex-col gap-5">
        <PassengerBackButton onNavigate={onNavigate} t={t} />
        <ViewHeader
          eyebrow={t.streex}
          preserveEyebrowCase
          title={t.tipTitle}
          description={t.tipSubtitle}
        />
      </div>
      <div className="passenger-tip-content rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-[#E6CE20]/10 p-6">
        <div className="passenger-tip-copy">
          <p className="text-2xl font-extrabold tracking-tight">{t.tipOptionsTitle}</p>
          <p className="mt-2 text-sm text-white/55">{t.tipOptionsNote}</p>
        </div>
        <div className="passenger-tip-workspace grid min-h-0 gap-5">
          <div className="passenger-tip-methods flex min-w-0 flex-col gap-3">
            <p className="text-sm font-semibold text-white/70">{t.tipInstruction}</p>
            {paymentMethods.map((method) => {
              const active = method.id === selectedMethod.id;
              const available = Boolean(method.href);
              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={!available}
                  onClick={() => setSelectedMethodId(method.id)}
                  className={`flex min-h-[78px] items-center gap-4 rounded-[20px] border p-4 text-left transition ${
                    active ? "border-[#E6CE20]/70 bg-[#E6CE20]/15" : "border-white/10 bg-black/20"
                  } ${available ? "hover:border-[#E6CE20]/45" : "cursor-not-allowed opacity-45"}`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#E6CE20]/15 text-[#E6CE20]">
                    {method.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{method.label}</span>
                    <span className="mt-1 block truncate text-xs text-white/50">
                      {method.detail}
                    </span>
                  </span>
                  {available && <ChevronRight className="ml-auto h-5 w-5 text-white/35" />}
                </button>
              );
            })}
          </div>
          <div className="passenger-tip-qr flex min-w-0 flex-col items-center justify-center rounded-[24px] border border-white/10 bg-black/25 p-5 text-center">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#E6CE20]">
              {selectedMethod.label}
            </p>
            {selectedMethod.href && (
              <div className="rounded-[20px] bg-white p-3 shadow-[0_0_45px_rgba(230,206,32,0.12)]">
                <QRCodeSVG
                  value={selectedMethod.href}
                  size={196}
                  bgColor="#FFFFFF"
                  fgColor="#0B0B0B"
                  level="M"
                />
              </div>
            )}
            <p className="mt-4 text-lg font-extrabold">{t.tipScan}</p>
            <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-white/50">
              {t.tipSecure}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneContinuationCard({
  compact = false,
  description,
  href,
  label,
  unavailable,
}: {
  compact?: boolean;
  description: string;
  href: string | null;
  label: string;
  unavailable: string;
}) {
  if (!href) {
    return <ActionLink href={null} icon={<QrCode />} label={label} unavailable={unavailable} />;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={
        compact
          ? "flex min-h-[166px] flex-col rounded-[24px] border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.07]"
          : "col-span-2 flex min-h-[182px] items-center gap-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-left transition hover:bg-white/[0.07]"
      }
    >
      <span className={`shrink-0 self-start rounded-xl bg-white ${compact ? "p-1.5" : "p-3"}`}>
        <QRCodeSVG
          value={href}
          size={compact ? 92 : 118}
          bgColor="#FFFFFF"
          fgColor="#0B0B0B"
          level="M"
        />
      </span>
      <span className={`min-w-0 flex-1 ${compact ? "mt-auto pt-3" : ""}`}>
        <span className="flex items-center gap-2 font-bold">
          {!compact && <QrCode className="h-4 w-4 text-[#E6CE20]" />}
          {label}
        </span>
        {!compact && (
          <span className="mt-1 block text-sm leading-relaxed text-white/55">{description}</span>
        )}
        <span className={`${compact ? "mt-1" : "mt-3"} block truncate text-xs text-[#E6CE20]`}>
          rides.getstreex.com
        </span>
      </span>
      {!compact && <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />}
    </a>
  );
}

function configOwnerLine(t: (typeof copy)[Language]) {
  return t.meetJuan === "Meet Juan"
    ? "The person behind your ride."
    : "La persona detrás de su viaje.";
}

function MeetJuanAction({
  config,
  label,
  onClick,
  subtitle,
}: {
  config: AppConfig;
  label: string;
  onClick: () => void;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[88px] w-full items-center gap-3 rounded-[22px] border border-[#E6CE20]/35 bg-gradient-to-br from-white/[0.07] to-[#E6CE20]/[0.07] p-3 text-left text-white transition hover:border-[#E6CE20]/60 hover:bg-[#E6CE20]/[0.1]"
    >
      <img
        src={config.meetPhoto}
        alt={config.ownerName}
        loading="lazy"
        decoding="async"
        className="h-11 w-11 shrink-0 rounded-xl border border-[#E6CE20]/40 object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-white/55">{subtitle}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#E6CE20] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function ActionLink({
  accent = false,
  href,
  icon,
  label,
  unavailable,
}: {
  accent?: boolean;
  href: string | null;
  icon: React.ReactNode;
  label: string;
  unavailable?: string;
}) {
  const className = `flex min-h-[88px] items-center gap-4 rounded-[22px] border p-4 text-left transition ${accent ? "border-[#E6CE20] bg-[#E6CE20] text-black hover:brightness-105" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"} ${!href ? "cursor-not-allowed opacity-65" : ""}`;
  const content = (
    <>
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent ? "bg-black/10" : "bg-[#E6CE20]/15 text-[#E6CE20]"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {unavailable && (
          <span className={`mt-1 block text-xs ${accent ? "text-black/65" : "text-white/50"}`}>
            {unavailable}
          </span>
        )}
      </span>
      <ChevronRight className={`h-5 w-5 ${accent ? "text-black/70" : "text-white/45"}`} />
    </>
  );
  if (!href)
    return (
      <div aria-disabled="true" className={className}>
        {content}
      </div>
    );
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={className}
    >
      {content}
    </a>
  );
}

function ActionButton({
  accent = false,
  icon,
  label,
  onClick,
}: {
  accent?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-h-[88px] items-center gap-4 rounded-[22px] border p-4 text-left transition ${accent ? "border-[#E6CE20] bg-[#E6CE20] text-black hover:brightness-105" : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"}`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent ? "bg-black/10" : "bg-[#E6CE20]/15 text-[#E6CE20]"}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
      </span>
      <ChevronRight className={`h-5 w-5 ${accent ? "text-black/70" : "text-white/45"}`} />
    </button>
  );
}

function MeetJuanView({
  config,
  language,
  onNavigate,
  reviews,
  t,
}: {
  config: AppConfig;
  language: Language;
  onNavigate: (view: View) => void;
  reviews: PassengerReview[];
  t: (typeof copy)[Language];
}) {
  const meetBody = language === "es" ? config.meetBodyEs : config.meetBody;

  return (
    <div className="passenger-meet-layout flex flex-col gap-5">
      <button
        type="button"
        onClick={() => onNavigate("streex")}
        className="passenger-meet-back flex w-fit items-center gap-2 text-sm text-white/55 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </button>
      <section className="passenger-meet-profile relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#E6CE20]/15 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <img
            src={config.meetPhoto}
            alt={config.ownerName}
            loading="lazy"
            decoding="async"
            className="h-20 w-20 rounded-3xl border-2 border-[#E6CE20]/45 object-cover"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E6CE20]">
              {t.meetJuan}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold">{t.meetIntro}</h1>
          </div>
        </div>
        <div className="relative mt-6 space-y-3 text-sm leading-relaxed text-white/75">
          {meetBody.slice(0, 4).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Chip icon={<Languages className="h-4 w-4" />} label={t.bilingual} />
          <Chip icon={<Sparkles className="h-4 w-4" />} label={t.hospitality} />
        </div>
      </section>
      <section className="passenger-meet-gratitude rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
        <p className="text-sm leading-relaxed text-white/65">{t.gratitude}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ActionButton
            icon={<Star />}
            label={t.leaveReview}
            onClick={() => onNavigate("reviews")}
          />
          <ActionButton
            accent
            icon={<HandCoins />}
            label={t.leaveTip}
            onClick={() => onNavigate("tip")}
          />
        </div>
      </section>
      <div className="passenger-meet-notes min-h-0">
        <GuestNotesMosaic reviews={reviews} t={t} />
      </div>
    </div>
  );
}

function GuestNotesMosaic({
  reviews,
  t,
}: {
  reviews: PassengerReview[];
  t: (typeof copy)[Language];
}) {
  return (
    <section className="passenger-meet-notes-panel rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E6CE20]">
            {t.guestNotesEyebrow}
          </p>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">{t.guestNotesTitle}</h2>
        </div>
      </div>
      {reviews.length > 0 ? (
        <div className="passenger-meet-notes-grid mt-5 grid min-h-0 grid-cols-3 gap-3">
          {reviews.slice(0, 3).map((review, index) => (
            <PassengerReviewCard
              key={`${review.name}-${review.text}`}
              className={index === 1 ? "row-span-2" : "col-span-2"}
              featured={index === 1}
              review={review}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/55">
          {t.noApprovedReviews}
        </p>
      )}
    </section>
  );
}

function PassengerReviewCard({
  className,
  featured = false,
  review,
}: {
  className?: string;
  featured?: boolean;
  review: PassengerReview;
}) {
  return (
    <article
      className={`passenger-review-card flex min-h-[118px] min-w-0 flex-col justify-between rounded-[22px] border p-4 ${
        featured
          ? "border-[#E6CE20]/30 bg-gradient-to-br from-[#E6CE20]/18 to-[#E6CE20]/[0.03]"
          : "border-white/10 bg-black/20"
      } ${className ?? ""}`}
    >
      <div>
        <div className="mb-3 flex gap-1" aria-label={`${review.stars} out of 5 stars`}>
          {Array.from({ length: Math.min(5, Math.max(0, review.stars)) }).map((_, index) => (
            <Star
              key={index}
              className="h-3.5 w-3.5 text-[#E6CE20]"
              fill="#E6CE20"
              strokeWidth={0}
            />
          ))}
        </div>
        <p className="passenger-review-card-copy min-w-0 break-words text-sm font-medium leading-relaxed text-white/85 [overflow-wrap:anywhere]">
          “{review.text}”
        </p>
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#E6CE20]">
          {review.name}
        </p>
        {review.location && <p className="mt-1 text-xs text-white/45">{review.location}</p>}
      </div>
    </article>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/80">
      {icon}
      {label}
    </span>
  );
}

function ViewHeader({
  description,
  eyebrow,
  preserveEyebrowCase = false,
  title,
}: {
  description: string;
  eyebrow: string;
  preserveEyebrowCase?: boolean;
  title: string;
}) {
  return (
    <header>
      <p
        className={`text-[10px] font-semibold tracking-[0.22em] text-[#E6CE20] ${
          preserveEyebrowCase ? "" : "uppercase"
        }`}
      >
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{description}</p>
    </header>
  );
}

function ConsoleNavigation({
  activeView,
  onNavigate,
  showAroundYou,
  t,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  showAroundYou: boolean;
  t: (typeof copy)[Language];
}) {
  const active =
    activeView === "meet-juan" ||
    activeView === "services" ||
    activeView === "contact" ||
    activeView === "reviews" ||
    activeView === "tip" ||
    activeView === "where-we-ride"
      ? "streex"
      : activeView;
  const items = [
    { id: "home" as const, label: t.home, icon: <Play className="h-5 w-5 rotate-[270deg]" /> },
    { id: "music" as const, label: t.music, icon: <Music2 className="h-5 w-5" /> },
    { id: "games" as const, label: t.games, icon: <Gamepad2 className="h-5 w-5" /> },
    ...(showAroundYou
      ? [
          {
            id: "around-you" as const,
            label: t.aroundYou,
            icon: <Compass className="h-5 w-5" />,
          },
        ]
      : []),
    {
      id: "streex" as const,
      label: t.streex,
      icon: (
        <img
          src="/icons/streex-mark-black-48.png"
          alt=""
          aria-hidden="true"
          className="h-5 w-5 rounded-sm object-contain"
        />
      ),
    },
  ];
  return (
    <nav
      aria-label="Passenger console"
      className="z-20 mt-4 flex shrink-0 gap-1 rounded-[28px] border border-white/10 bg-[#161614]/95 p-2 backdrop-blur"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className={`flex min-h-[62px] flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-2 text-xs font-semibold transition ${active === item.id ? "bg-[#E6CE20] text-black" : "text-white/65 hover:bg-white/[0.05] hover:text-white"}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

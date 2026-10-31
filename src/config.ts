// To customize this template, edit src/config.ts
import streexLogo from "@/assets/brand/streex-rides-transparent.webp";
import type { PassengerVisualTheme } from "@/lib/passenger-visual-theme";
export const CONFIG = {
  // ─── BRAND ───────────────────────────────────
  brandName: "Streex Rides",
  ownerName: "Juan",
  tagline: "Private rides. Elevated.",
  subheadline:
    "Premium private rides across Salt Lake City & Park City. Reliable, comfortable and personalized transportation — designed to elevate your journey.",
  logoSrc: streexLogo,

  // ─── CONTACT ─────────────────────────────────
  phone: "+18017974971",
  phoneDisplay: "(801) 797-4971",
  email: "streex.rides@gmail.com",
  website: "https://rides.getstreex.com",

  // ─── SOCIAL ──────────────────────────────────
  instagram: "streex.rides",
  instagramUrl: "https://instagram.com/streex.rides",
  instagramDM: "https://ig.me/m/streex.rides",
  whatsapp: "https://wa.me/18017974971",
  googleReviews: "",
  nextdoor: "",

  // ─── PAYMENT ─────────────────────────────────
  venmo: "https://venmo.com/juangaudino",
  cashapp: "https://cash.app/$juangaudino",
  applePayPhone: "+18017974971",
  applePayPhoneDisplay: "(801) 797-4971",

  // ─── BOOKING ─────────────────────────────────
  calUrl: "https://cal.com/streex-riders",

  // ─── WIFI ────────────────────────────────────
  wifiName: "STREEX-5G",
  wifiPassword: null as string | null,

  // ─── PASSENGER CONSOLE ───────────────────────
  // Public, non-sensitive settings for the in-vehicle tablet experience at /passenger.
  // Keep credentials, device PINs, provider tokens and passenger data out of this object.
  passengerConsole: {
    enabled: true,
    // RELOAD 1.0 Lite is the daily, acquisition-focused Passenger experience. It keeps
    // local discovery available from Home while hiding it from the primary navigation.
    // A future driver-controlled Complete mode can change this value remotely.
    experienceMode: "lite" as "lite" | "complete",
    // Lite-only launch palette. Switch this single value to "original" to restore the
    // existing Passenger color treatment; Complete deliberately remains Original for now.
    liteTheme: "accent" as "original" | "accent",
    // Manual seasonal pilot. Absence preserves the existing mode-specific palette.
    visualTheme: null as PassengerVisualTheme | null,
    idleReset: {
      // Lite beta cadence. Music remains the only published idle hero in Lite;
      // the secondary rail rotates independently beneath it.
      inactivitySeconds: 90,
      featureRotationSeconds: 30,
      defaultLanguage: "en" as "en" | "es",
    },
    clock: {
      localTimeZone: "America/Denver",
      secondaryTimeZones: {
        east: "America/New_York",
        central: "America/Chicago",
        pacific: "America/Los_Angeles",
      },
    },
    weather: {
      city: "Salt Lake City",
      latitude: 40.7608,
      longitude: -111.891,
      refreshMinutes: 15,
      // Used only when live weather has not loaded yet or is temporarily unavailable.
      fallbackTemperatureFahrenheit: 72,
    },
    music: {
      enabled: true,
      // The server-side SPOTIFY_PERSONAL_INTEGRATION_ENABLED switch remains the final
      // activation gate. Keep credentials, tokens and device identifiers out of this config.
      mode: "provider" as "simulated" | "provider",
      providerName: "Spotify" as string | null,
      searchEnabled: true,
      searchResultLimit: 8,
      // Public catalog market used only for server-side Spotify song search.
      catalogMarket: "US",
    },
    games: {
      utahTriviaEnabled: true,
      thisOrThatEnabled: true,
      utahHigherOrLowerEnabled: true,
    },
    aroundYou: {
      // The dedicated tablet now has a validated browser location permission. Coordinates
      // stay in memory on that device only; Around You never persists or transmits them.
      enabled: true,
      geolocation: {
        // Around You is intentionally a calm, low-frequency discovery surface. It samples
        // only while Home or Around You is open; it is not turn-by-turn navigation.
        samplingIntervalMs: 5 * 60_000,
        enableHighAccuracy: false,
        timeoutMs: 10_000,
        maximumAgeMs: 60_000,
        minimumAcceptedIntervalMs: 30_000,
        minimumMovementMeters: 120,
        maximumUsableAccuracyMeters: 250,
        maximumLastGoodPositionAgeMs: 5 * 60_000,
        materialAccuracyImprovementMeters: 50,
        maximumPlausibleSpeedMetersPerSecond: 85,
      },
      selection: {
        nearbyLimit: 5,
        minimumFeaturedDwellMs: 30_000,
        exitRadiusMultiplier: 1.25,
        challengerScoreRatio: 1.15,
        recentlyShownCooldownMs: 10 * 60_000,
      },
      ui: {
        showHomeCard: true,
        showDistance: true,
        showAccuracyDebug: false,
        // Compact Around You idle treatments are intentionally unpublished in Lite until
        // their companion Music layout has a dedicated visual pass.
        showIdleCard: false,
      },
    },
    links: {
      // Public destinations rendered as QR codes or phone-continuation links. Keep payment
      // provider secrets out of this object; a Stripe-hosted Payment Link is safe to expose.
      phoneContinuation: "https://rides.getstreex.com",
      stripeTip: "https://buy.stripe.com/aFa00ibto7GZ6aYaa45AQ00" as string | null,
    },
  },

  // ─── COLORS ──────────────────────────────────
  accentColor: "#E6CE20",
  backgroundColor: "#0B0B0B",

  // ─── TICKER SERVICES ─────────────────────────
  // Options: "boarding" | "pill"
  tickerStyle: "boarding",
  tickerServices: [
    "Airport Transfers",
    "Park City",
    "Scheduled Rides",
    "Hourly Service",
    "Corporate Travel",
    "Private Events",
    "Bilingual Service",
    "Las Vegas",
  ],

  // ─── HERO CHIPS ──────────────────────────────
  heroChips: ["Airport Rides", "Scheduled Rides", "Park City", "Long Distance", "Hourly Service"],

  // ─── SERVICES GRID ───────────────────────────
  services: [
    {
      id: "airport",
      icon: "PlaneTakeoff",
      name: "Airport Transfers",
      price: "From $40",
      subtitle: null as string | null,
      enabled: true,
    },
    {
      id: "parkcity",
      icon: "Mountain",
      name: "Park City",
      price: "From $80",
      subtitle: null as string | null,
      enabled: true,
    },
    {
      id: "scheduled",
      icon: "CalendarCheck",
      name: "Scheduled Rides",
      price: "From $40",
      subtitle: null as string | null,
      enabled: true,
    },
    {
      id: "hourly",
      icon: "Clock",
      name: "Hourly Service",
      price: "$60/hr · 40 mi included",
      subtitle: "$1 per additional mile" as string | null,
      enabled: true,
    },
    {
      id: "corporate",
      icon: "Briefcase",
      name: "Corporate Travel",
      price: "Contact for quote",
      subtitle: null as string | null,
      enabled: true,
    },
    {
      id: "longdistance",
      icon: "MapPin",
      name: "Long Distance",
      price: "Contact for quote",
      subtitle: null as string | null,
      enabled: true,
    },
    {
      id: "lasvegas",
      icon: "Sparkles",
      name: "Las Vegas",
      price: "Contact for quote",
      subtitle: null as string | null,
      enabled: false,
    }, // CONFIG: set true to activate
    {
      id: "privateevents",
      icon: "Star",
      name: "Private Events",
      price: "Contact for quote",
      subtitle: null as string | null,
      enabled: false,
    }, // CONFIG: set true to activate
  ],

  // ─── SECTIONS VISIBILITY ─────────────────────
  sections: {
    wifi: true,
    textMe: true,
    callMe: true,
    saveContact: true,
    scheduleRide: true,
    moreOptions: true,
    experienceGallery: true,
    servicesGrid: true,
    serviceAreas: true,
    reviews: true,
    whyStreex: true,
    meetJuan: true,
    paymentOptions: true,
    findUs: true,
    feedbackForm: true,
    faq: true,
  },

  // ─── TENANT MEDIA ────────────────────────────
  galleryImages: [
    {
      label: "Salt Lake City",
      image: "/images/streex/slc.webp",
      microLabel: null as string | null,
    },
    {
      label: "Park City",
      image: "/images/streex/park-city.webp",
      microLabel: null as string | null,
    },
    {
      label: "SLC Airport",
      image: "/images/streex/airport.webp",
      microLabel: null as string | null,
    },
    {
      label: "Mountain Routes",
      image: "/images/streex/mountains.webp",
      microLabel: null as string | null,
    },
    {
      label: "Your Ride",
      image: "/images/streex/rav4.webp",
      microLabel: "✦ Toyota RAV4 • Spacious SUV" as string | null,
    },
  ],

  // ─── WHY STREEX ──────────────────────────────
  whyStreexTitle: "Why Streex",
  whyStreexBody: [
    "Streex was created to offer something different — a more thoughtful, comfortable and elevated transportation experience in Utah. Every ride is designed around you: your schedule, your comfort, your experience.",
    "Built by someone with a background in branding and technology, Streex is more than a ride. It's the beginning of a better way to move.",
  ],

  // ─── MEET OWNER ──────────────────────────────
  meetTitle: "Meet Juan",
  meetPhoto: "/images/streex/juan.webp",
  meetBody: [
    "Hi, I'm Juan — creator of Streex Rides.",
    "I believe transportation can be more than a ride — it can be a genuinely comfortable and thoughtful experience.",
    "Fluent in English and Spanish, with a background in branding, technology and creative projects, I built Streex around one simple idea: details matter.",
    "While continuing my studies at Weber State University, I'm building Streex as a more personal, elevated and human way to move around Utah.",
    "I look forward to being your driver.",
  ],
  meetBodyEs: [
    "Hola, soy Juan — creador de Streex Rides.",
    "Creo que el transporte puede ser más que un viaje: puede ser una experiencia genuinamente cómoda y considerada.",
    "Hablo inglés y español. Con experiencia en branding, tecnología y proyectos creativos, construí Streex alrededor de una idea simple: los detalles importan.",
    "Mientras continúo mis estudios en Weber State University, construyo Streex como una forma más personal, elevada y humana de moverse por Utah.",
    "Espero ser tu conductor.",
  ],

  // ─── AREAS SERVED ────────────────────────────
  areas: [
    "Salt Lake City",
    "Park City",
    "SLC Airport",
    "Ogden",
    "Farmington",
    "Layton",
    "Clearfield",
    "South Salt Lake",
    "Sandy",
    "Draper",
    "Provo",
    "Lehi",
    "Las Vegas",
    "Idaho",
  ],

  // ─── SEO ─────────────────────────────────────
  seoTitle: "Streex Rides | Private Rides in Salt Lake City, Park City & SLC Airport",
  seoDescription:
    "Private rides. Elevated. Premium private transportation across Salt Lake City, Park City, SLC Airport and surrounding Utah areas, including hourly service and long-distance rides to Las Vegas.",
  seoUrl: "https://rides.getstreex.com",
  ogImage: "https://rides.getstreex.com/images/streex/streex-og-preview-v2.jpg",
};

export type AppConfig = typeof CONFIG;

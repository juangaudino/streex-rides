import { z } from "zod";
import { CONFIG, type AppConfig } from "@/config";
import { PASSENGER_VISUAL_THEMES } from "./passenger-visual-theme";

export const SITE_CONFIG_KEY = "site_config_v2";

const SectionsOverrideSchema = z
  .object({
    wifi: z.boolean().optional(),
    textMe: z.boolean().optional(),
    callMe: z.boolean().optional(),
    saveContact: z.boolean().optional(),
    scheduleRide: z.boolean().optional(),
    moreOptions: z.boolean().optional(),
    experienceGallery: z.boolean().optional(),
    servicesGrid: z.boolean().optional(),
    serviceAreas: z.boolean().optional(),
    reviews: z.boolean().optional(),
    whyStreex: z.boolean().optional(),
    meetJuan: z.boolean().optional(),
    paymentOptions: z.boolean().optional(),
    findUs: z.boolean().optional(),
    feedbackForm: z.boolean().optional(),
    faq: z.boolean().optional(),
  })
  .strict();

const ServiceOverrideSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120).optional(),
  price: z.string().trim().max(120).optional(),
  enabled: z.boolean().optional(),
});

const GalleryImageSchema = z.object({
  label: z.string().trim().min(1).max(100),
  image: z.string().trim().min(1).max(1000),
  microLabel: z.string().trim().max(160).nullable().optional(),
});

const PassengerConsoleOverrideSchema = z
  .object({
    experienceMode: z.enum(["lite", "complete"]).optional(),
    // A malformed seasonal setting must never discard the rest of a saved config.
    visualTheme: z.enum(PASSENGER_VISUAL_THEMES).optional().catch(undefined),
  })
  .strict();

export const SiteConfigOverrideSchema = z
  .object({
    brandName: z.string().trim().min(1).max(120).optional(),
    ownerName: z.string().trim().min(1).max(120).optional(),
    tagline: z.string().trim().min(1).max(180).optional(),
    subheadline: z.string().trim().min(1).max(500).optional(),
    logoSrc: z.string().trim().min(1).max(1000).optional(),
    meetPhoto: z.string().trim().min(1).max(1000).optional(),
    galleryImages: z.array(GalleryImageSchema).max(12).optional(),
    areas: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    meetTitle: z.string().trim().min(1).max(160).optional(),
    meetBody: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
    meetBodyEs: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
    whyStreexTitle: z.string().trim().min(1).max(160).optional(),
    whyStreexBody: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
    seoTitle: z.string().trim().min(1).max(180).optional(),
    seoDescription: z.string().trim().min(1).max(500).optional(),
    ogImage: z.string().trim().min(1).max(1000).optional(),
    phone: z.string().trim().min(5).max(40).optional(),
    phoneDisplay: z.string().trim().min(5).max(40).optional(),
    email: z.string().trim().email().max(200).optional(),
    website: z.string().trim().url().max(240).optional(),
    instagram: z.string().trim().max(80).optional(),
    instagramUrl: z.string().trim().url().max(240).optional(),
    instagramDM: z.string().trim().url().max(240).optional(),
    whatsapp: z.string().trim().url().max(240).optional(),
    googleReviews: z.string().trim().max(240).optional(),
    nextdoor: z.string().trim().max(240).optional(),
    services: z.array(ServiceOverrideSchema).optional(),
    sections: SectionsOverrideSchema.optional(),
    passengerConsole: PassengerConsoleOverrideSchema.optional(),
  })
  .strict();

export type SiteConfigOverride = z.infer<typeof SiteConfigOverrideSchema>;

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.trim();
}

export function normalizeInstagram(value: string) {
  return value.trim().replace(/^@+/, "");
}

function makeInstagramUrl(handle: string) {
  return handle ? `https://instagram.com/${handle}` : "";
}

function makeInstagramDm(handle: string) {
  return handle ? `https://ig.me/m/${handle}` : "";
}

export function mergeSiteConfig(
  base: AppConfig = CONFIG,
  override?: SiteConfigOverride | null,
): AppConfig {
  if (!override) return base;

  const instagram = normalizeInstagram(override.instagram ?? base.instagram);
  const phoneDisplay = override.phoneDisplay ?? base.phoneDisplay;
  const phone = override.phone ?? normalizePhone(phoneDisplay);
  const next: AppConfig = {
    ...base,
    ...override,
    instagram,
    phone,
    phoneDisplay,
    instagramUrl: override.instagramUrl ?? makeInstagramUrl(instagram),
    instagramDM: override.instagramDM ?? makeInstagramDm(instagram),
    services: base.services.map((service) => {
      const changed = override.services?.find((item) => item.id === service.id);
      return changed ? { ...service, ...changed } : service;
    }),
    galleryImages: (override.galleryImages ?? base.galleryImages).map((item) => ({
      ...item,
      microLabel: item.microLabel ?? null,
    })),
    sections: {
      ...base.sections,
      ...(override.sections ?? {}),
    },
    passengerConsole: {
      ...base.passengerConsole,
      ...(override.passengerConsole ?? {}),
      visualTheme: override.passengerConsole?.visualTheme ?? base.passengerConsole.visualTheme,
    },
  };

  return next;
}

export function parseSiteConfigOverride(
  value: string | null | undefined,
): SiteConfigOverride | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return SiteConfigOverrideSchema.parse(parsed);
  } catch (error) {
    console.error("[site-config] Invalid saved config. Using fallback.", error);
    return null;
  }
}

import { Check, MoonStar, Palette } from "lucide-react";
import type { PassengerVisualTheme } from "@/lib/passenger-visual-theme";

const themes: {
  id: PassengerVisualTheme;
  title: string;
  description: string;
  background: string;
  accent: string;
}[] = [
  {
    id: "original",
    title: "Original",
    description: "Classic STREEX",
    background: "linear-gradient(135deg,#101010,#272727)",
    accent: "#e6ce20",
  },
  {
    id: "accent",
    title: "Accent",
    description: "Current launch palette",
    background: "radial-gradient(ellipse at 75% 10%,#77601b,#17150c 75%)",
    accent: "#ffd85a",
  },
  {
    id: "halloween",
    title: "Halloween",
    description: "Haunted Night Edition",
    background:
      "radial-gradient(circle at 75% 22%,#b8a5df 0 6%,#3c2457 7%,transparent 35%),linear-gradient(145deg,#0d0717,#281430 60%,#7a391c)",
    accent: "#ffab69",
  },
];

export function PassengerVisualThemeControl({
  value,
  onChange,
}: {
  value: PassengerVisualTheme;
  onChange: (theme: PassengerVisualTheme) => void;
}) {
  return (
    <section
      className="passenger-theme-control rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      aria-label="Tema visual"
    >
      <div className="flex items-start gap-3">
        <Palette className="mt-1 h-5 w-5 shrink-0 text-[#E6CE20]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Tema visual</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/55">
            Independent of Lite / Complete. Save config, then reload Passenger on the tablet.
            Halloween changes Home, Music and the idle screen; Games keeps its current appearance.
          </p>
        </div>
      </div>
      <div
        className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="group"
        aria-label="Passenger visual theme"
      >
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            aria-pressed={value === theme.id}
            onClick={() => onChange(theme.id)}
            className={`overflow-hidden rounded-xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E6CE20] ${value === theme.id ? "border-[#E6CE20] bg-[#E6CE20]/[0.06]" : "border-white/15 bg-black/15 hover:border-white/35"}`}
          >
            <span
              className="relative block h-24 overflow-hidden border-b border-white/10"
              style={{ background: theme.background }}
              aria-hidden="true"
            >
              <span className="absolute bottom-4 left-4 h-7 w-[43%] rounded-lg border border-white/20 bg-black/40" />
              <span
                className="absolute bottom-4 right-4 h-7 w-[22%] rounded-lg"
                style={{ background: theme.accent }}
              />
              {theme.id === "halloween" ? (
                <MoonStar className="absolute left-4 top-4 h-5 w-5 text-[#ffba81]" />
              ) : null}
              {value === theme.id ? (
                <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[#E6CE20] text-black">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
            </span>
            <span className="block px-4 py-3">
              <span className="block text-sm font-bold">{theme.title}</span>
              <span className="mt-1 block text-xs text-white/55">{theme.description}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-white/55">
        Manual activation only. Select Original or Accent and save to remove Halloween completely.
      </p>
    </section>
  );
}

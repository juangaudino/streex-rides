import { useEffect, useRef } from "react";

/**
 * Lightweight weather atmosphere for the Passenger forecast dialog.
 * It is presentational only: native Canvas, no external assets or requests.
 */
export type AtmosphereVariant =
  | "thunderstorms"
  | "rain"
  | "snow"
  | "fog"
  | "smoke"
  | "partly-cloudy-night"
  | "cloudy"
  | "clear";

const BACKGROUNDS: Record<AtmosphereVariant, string> = {
  thunderstorms: "radial-gradient(ellipse at 30% 20%, #1a1a3e 0%, #0b0b0b 70%)",
  rain: "radial-gradient(ellipse at 34% 15%, #162644 0%, #090d14 72%)",
  snow: "radial-gradient(ellipse at 40% 15%, #12203a 0%, #0a0f1e 70%)",
  fog: "radial-gradient(ellipse at 50% 10%, #27313e 0%, #0c1014 74%)",
  smoke: "radial-gradient(ellipse at 38% 12%, #35291e 0%, #11100e 74%)",
  "partly-cloudy-night": "radial-gradient(ellipse at 75% 12%, #131b33 0%, #080c18 72%)",
  cloudy: "radial-gradient(ellipse at 48% 16%, #1e2730 0%, #0a0d10 74%)",
  clear: "radial-gradient(ellipse at 82% 6%, #765500 0%, #241b00 42%, #0b0b0b 78%)",
};

type Drop = { x: number; y: number; len: number; speed: number; alpha: number };
type Flake = { x: number; y: number; r: number; speed: number; phase: number; drift: number };
type Particle = { x: number; y: number; r: number; speed: number; drift: number; alpha: number };
type Star = { x: number; y: number; r: number; phase: number; rate: number };

const RAIN_ANGLE = (15 * Math.PI) / 180;

export function WeatherAtmosphere({
  variant,
  active = true,
  className = "",
}: {
  variant: AtmosphereVariant;
  active?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const drops: Drop[] = [];
    const flakes: Flake[] = [];
    const particles: Particle[] = [];
    const stars: Star[] = [];

    const seed = () => {
      drops.length = 0;
      flakes.length = 0;
      particles.length = 0;
      stars.length = 0;
      if (variant === "thunderstorms" || variant === "rain") {
        const count = variant === "thunderstorms" ? 220 : 130;
        for (let index = 0; index < count; index += 1) {
          drops.push({
            x: Math.random() * (width + height),
            y: Math.random() * height,
            len: 10 + Math.random() * (variant === "thunderstorms" ? 28 : 18),
            speed: (variant === "thunderstorms" ? 520 : 310) + Math.random() * 620,
            alpha: 0.25 + Math.random() * 0.42,
          });
        }
      } else if (variant === "snow") {
        for (let index = 0; index < 150; index += 1) {
          const r = 1 + Math.random() * 2;
          flakes.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r,
            speed: 14 + r * 16 + Math.random() * 14,
            phase: Math.random() * Math.PI * 2,
            drift: 8 + Math.random() * 22,
          });
        }
      } else if (variant === "partly-cloudy-night" || variant === "clear" || variant === "cloudy") {
        const count = variant === "partly-cloudy-night" ? 72 : variant === "clear" ? 46 : 34;
        for (let index = 0; index < count; index += 1) {
          stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.7 + Math.random() * 1.7,
            phase: Math.random() * Math.PI * 2,
            rate: 0.35 + Math.random() * 1.1,
          });
        }
      } else if (variant === "fog" || variant === "smoke") {
        const count = variant === "smoke" ? 54 : 38;
        for (let index = 0; index < count; index += 1) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: (variant === "smoke" ? 18 : 26) + Math.random() * 70,
            speed: 4 + Math.random() * 13,
            drift: 8 + Math.random() * 24,
            alpha: (variant === "smoke" ? 0.025 : 0.035) + Math.random() * 0.045,
          });
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frameId: number | null = null;
    let last = performance.now();
    let nextStrike = performance.now() + 2500 + Math.random() * 3500;

    const flash = () => {
      const element = flashRef.current;
      if (!element) return;
      element.style.transition = "none";
      element.style.opacity = "0.15";
      window.setTimeout(() => {
        element.style.transition = "opacity 120ms linear";
        element.style.opacity = "0";
      }, 20);
      window.setTimeout(() => {
        element.style.transition = "none";
        element.style.opacity = "0.07";
        window.setTimeout(() => {
          element.style.transition = "opacity 140ms linear";
          element.style.opacity = "0";
        }, 20);
      }, 200);
    };

    const drawClouds = (time: number, alpha = 0.06) => {
      ctx.save();
      for (const cloud of [
        { x: 0.08, y: 0.13, scale: 1.08, speed: 0.000018 },
        { x: 0.42, y: 0.34, scale: 0.92, speed: 0.000012 },
        { x: 0.76, y: 0.09, scale: 1.04, speed: 0.000015 },
        { x: 1.04, y: 0.56, scale: 1.18, speed: 0.00001 },
      ]) {
        const offset = ((time * cloud.speed + cloud.x) % 1.4) - 0.2;
        const cx = offset * width;
        const cy = cloud.y * height;
        const scale = cloud.scale * (width / 900);
        ctx.fillStyle = `rgba(200, 214, 245, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 230 * scale, 72 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 145 * scale, cy - 26 * scale, 162 * scale, 56 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 155 * scale, cy + 14 * scale, 145 * scale, 50 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 24 * scale, cy - 45 * scale, 132 * scale, 48 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      if (variant === "thunderstorms" || variant === "rain") {
        const dx = Math.sin(RAIN_ANGLE);
        const dy = Math.cos(RAIN_ANGLE);
        ctx.lineCap = "round";
        for (const drop of drops) {
          drop.x += dx * drop.speed * dt;
          drop.y += dy * drop.speed * dt;
          if (drop.y > height) {
            drop.y = -20 - Math.random() * height * 0.3;
            drop.x = Math.random() * (width + height) - height * 0.3;
          }
          ctx.strokeStyle = `rgba(180, 205, 255, ${drop.alpha})`;
          ctx.lineWidth = drop.len > 30 ? 1.35 : 1;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - dx * drop.len, drop.y - dy * drop.len);
          ctx.stroke();
        }
        if (variant === "thunderstorms" && !reduced && now > nextStrike) {
          flash();
          nextStrike = now + 4000 + Math.random() * 4000;
        }
      } else if (variant === "snow") {
        for (const flake of flakes) {
          flake.phase += dt * 1.1;
          flake.y += flake.speed * dt;
          const x = flake.x + Math.sin(flake.phase) * flake.drift;
          if (flake.y - flake.r > height) {
            flake.y = -8;
            flake.x = Math.random() * width;
          }
          ctx.fillStyle = `rgba(233, 242, 255, ${0.35 + flake.r * 0.14})`;
          ctx.beginPath();
          ctx.arc(x, flake.y, flake.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (variant === "partly-cloudy-night") {
        const moonX = width * 0.86;
        const moonY = height * 0.14;
        const halo = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 210);
        halo.addColorStop(0, "rgba(214, 226, 255, 0.32)");
        halo.addColorStop(0.35, "rgba(140, 160, 255, 0.12)");
        halo.addColorStop(1, "rgba(214, 226, 255, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(moonX - 220, moonY - 220, 440, 440);
        ctx.fillStyle = "rgba(232, 238, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(moonX + 13, moonY - 10, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        for (const star of stars) {
          star.phase += dt * star.rate;
          const brightness = 0.35 + (Math.sin(star.phase) + 1) * 0.28;
          ctx.fillStyle = `rgba(220,230,255,${brightness})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * (0.8 + brightness), 0, Math.PI * 2);
          ctx.fill();
        }
        drawClouds(now, 0.14);
      } else if (variant === "fog" || variant === "smoke") {
        const color = variant === "smoke" ? "191, 156, 116" : "208, 220, 235";
        for (const particle of particles) {
          particle.x += particle.speed * dt;
          particle.y += Math.sin((particle.x + now * 0.018) * 0.015) * particle.drift * dt;
          if (particle.x - particle.r > width) {
            particle.x = -particle.r;
            particle.y = Math.random() * height;
          }
          const haze = ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            particle.r,
          );
          haze.addColorStop(0, `rgba(${color}, ${particle.alpha})`);
          haze.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = haze;
          ctx.fillRect(
            particle.x - particle.r,
            particle.y - particle.r,
            particle.r * 2,
            particle.r * 2,
          );
        }
      } else if (variant === "cloudy") {
        const glow = ctx.createRadialGradient(
          width * 0.68,
          height * 0.16,
          12,
          width * 0.68,
          height * 0.16,
          Math.max(width, height) * 0.7,
        );
        glow.addColorStop(0, "rgba(179, 204, 255, 0.22)");
        glow.addColorStop(0.45, "rgba(116, 146, 191, 0.09)");
        glow.addColorStop(1, "rgba(30, 44, 62, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        drawClouds(now, 0.21);
        for (const star of stars) {
          star.phase += dt * star.rate;
          ctx.fillStyle = `rgba(202, 222, 255, ${0.08 + (Math.sin(star.phase) + 1) * 0.08})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const cx = width * 0.88;
        const cy = height * 0.08;
        const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(width, height) * 0.52);
        halo.addColorStop(0, "rgba(255, 235, 150, 0.42)");
        halo.addColorStop(0.18, "rgba(255, 198, 54, 0.18)");
        halo.addColorStop(1, "rgba(255, 189, 48, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((now / 90000) % (Math.PI * 2));
        const reach = Math.hypot(width, height) * 1.2;
        for (let index = 0; index < 14; index += 1) {
          ctx.rotate((Math.PI * 2) / 14);
          ctx.fillStyle = `rgba(255, 214, 120, ${index % 2 ? 0.14 : 0.27})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(reach, reach * 0.06);
          ctx.lineTo(reach, -reach * 0.06);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = "rgba(255, 241, 185, 0.94)";
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.fill();
        for (const star of stars) {
          star.phase += dt * star.rate;
          ctx.fillStyle = `rgba(255, 224, 125, ${0.18 + (Math.sin(star.phase) + 1) * 0.18})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frameId = requestAnimationFrame(draw);
    };

    const startAnimation = () => {
      if (frameId !== null || document.visibilityState === "hidden") return;
      last = performance.now();
      frameId = requestAnimationFrame(draw);
    };
    const stopAnimation = () => {
      if (frameId === null) return;
      cancelAnimationFrame(frameId);
      frameId = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopAnimation();
      } else {
        startAnimation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    startAnimation();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopAnimation();
      observer.disconnect();
    };
  }, [active, variant]);

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ background: BACKGROUNDS[variant] }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {variant === "thunderstorms" ? (
        <span ref={flashRef} className="absolute inset-0 bg-white" style={{ opacity: 0 }} />
      ) : null}
    </span>
  );
}

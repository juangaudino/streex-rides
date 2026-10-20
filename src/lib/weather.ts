export type PassengerWeatherCondition =
  | "clear"
  | "mostly-clear"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "thunderstorms"
  | "snow"
  | "fog"
  | "smoke"
  | "wind"
  | "unknown";

export type PassengerWeatherPeriod = {
  startTime: string;
  temperatureFahrenheit: number;
  condition: PassengerWeatherCondition;
  shortForecast: string;
  windSpeed: string | null;
  windDirection: string | null;
  precipitationChance: number | null;
};

export type PassengerWeatherSnapshot = {
  updatedAt: string;
  /** Display-safe location returned by NWS for the rounded device coordinate. */
  locationName?: string;
  periods: PassengerWeatherPeriod[];
  dailyPeriods?: PassengerWeatherPeriod[];
};

type NwsPeriod = {
  isDaytime?: unknown;
  startTime?: unknown;
  temperature?: unknown;
  temperatureUnit?: unknown;
  shortForecast?: unknown;
  windSpeed?: unknown;
  windDirection?: unknown;
  probabilityOfPrecipitation?: { value?: unknown } | null;
};

function normalizeCondition(value: string): PassengerWeatherCondition {
  const condition = value.toLowerCase();
  if (condition.includes("thunder")) return "thunderstorms";
  if (condition.includes("snow") || condition.includes("sleet") || condition.includes("blizzard"))
    return "snow";
  if (condition.includes("rain") || condition.includes("shower") || condition.includes("drizzle"))
    return "rain";
  if (condition.includes("smoke") || condition.includes("haze")) return "smoke";
  if (condition.includes("fog") || condition.includes("mist")) return "fog";
  if (condition.includes("wind") || condition.includes("breezy")) return "wind";
  if (
    condition.includes("partly") ||
    condition.includes("mostly sunny") ||
    condition.includes("mostly clear")
  ) {
    return condition.includes("mostly sunny") || condition.includes("mostly clear")
      ? "mostly-clear"
      : "partly-cloudy";
  }
  if (condition.includes("cloud") || condition.includes("overcast")) return "cloudy";
  if (condition.includes("clear") || condition.includes("sunny")) return "clear";
  return "unknown";
}

function fahrenheit(temperature: number, unit: string) {
  return unit.toUpperCase() === "C" ? (temperature * 9) / 5 + 32 : temperature;
}

function normalizeNwsForecast(
  payload: unknown,
  maximumPeriods: number,
  emptyMessage: string,
  daytimeOnly = false,
): PassengerWeatherSnapshot {
  const properties = (
    payload as {
      properties?: {
        updated?: unknown;
        updateTime?: unknown;
        generatedAt?: unknown;
        periods?: unknown;
      };
    } | null
  )?.properties;
  if (!properties || !Array.isArray(properties.periods)) {
    throw new Error("The weather service returned an invalid forecast.");
  }

  const periods = properties.periods
    .slice(0, maximumPeriods)
    .map((raw): PassengerWeatherPeriod | null => {
      const period = raw as NwsPeriod;
      if (
        (daytimeOnly && period.isDaytime === false) ||
        typeof period.startTime !== "string" ||
        typeof period.temperature !== "number" ||
        !Number.isFinite(period.temperature) ||
        typeof period.shortForecast !== "string"
      ) {
        return null;
      }

      const precipitation = period.probabilityOfPrecipitation?.value;
      return {
        startTime: period.startTime,
        temperatureFahrenheit: fahrenheit(
          period.temperature,
          typeof period.temperatureUnit === "string" ? period.temperatureUnit : "F",
        ),
        condition: normalizeCondition(period.shortForecast),
        shortForecast: period.shortForecast,
        windSpeed: typeof period.windSpeed === "string" ? period.windSpeed : null,
        windDirection: typeof period.windDirection === "string" ? period.windDirection : null,
        precipitationChance:
          typeof precipitation === "number" && Number.isFinite(precipitation)
            ? Math.max(0, Math.min(100, Math.round(precipitation)))
            : null,
      };
    })
    .filter((period): period is PassengerWeatherPeriod => period !== null);

  if (!periods.length) throw new Error(emptyMessage);

  return {
    updatedAt:
      [properties.generatedAt, properties.updateTime, properties.updated].find(
        (value): value is string => typeof value === "string",
      ) ?? new Date().toISOString(),
    periods,
  };
}

export function normalizeNwsHourlyForecast(payload: unknown): PassengerWeatherSnapshot {
  return normalizeNwsForecast(payload, 6, "The weather forecast has no usable hourly periods.");
}

export function normalizeNwsDailyForecast(payload: unknown): PassengerWeatherSnapshot {
  return normalizeNwsForecast(
    payload,
    8,
    "The weather forecast has no usable daily periods.",
    true,
  );
}

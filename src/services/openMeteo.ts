import type { ConditionsResponse, DataSourceInfo, GeoPoint } from "../types";
import type { SnorkelConditions, TideCondition, TideState } from "../conditions";
import { fetchTideConditions } from "./stormglass";

const MARINE_URL =
  (import.meta.env.VITE_OPEN_METEO_MARINE_URL as string | undefined) ??
  "https://marine-api.open-meteo.com/v1/marine";
const WEATHER_URL =
  (import.meta.env.VITE_OPEN_METEO_WEATHER_URL as string | undefined) ??
  "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoSeries {
  time: string[];
  wave_height?: number[];
  wave_period?: number[];
  wave_direction?: number[];
  swell_wave_height?: number[];
  swell_wave_period?: number[];
  swell_wave_direction?: number[];
  wind_speed_10m?: number[];
  wind_gusts_10m?: number[];
  wind_direction_10m?: number[];
  precipitation?: number[];
  cloud_cover?: number[];
  tide_height?: number[];
}

function buildSourceInfo(name: string, url: string): DataSourceInfo {
  return {
    name,
    url,
    fetchedAt: new Date().toISOString(),
  };
}

function pickNearestValue(times: string[], values: number[]): number | null {
  if (!times.length || !values.length) {
    return null;
  }
  const now = Date.now();
  let bestIndex = 0;
  let bestDelta = Math.abs(new Date(times[0]).getTime() - now);
  for (let i = 1; i < times.length; i += 1) {
    const delta = Math.abs(new Date(times[i]).getTime() - now);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  const value = values[bestIndex];
  return Number.isFinite(value) ? value : null;
}

function getTideState(value: number | null): TideState {
  if (value === null) {
    return "unknown";
  }
  if (value > 0.6) {
    return "high";
  }
  if (value > 0.1) {
    return "rising";
  }
  if (value > -0.2) {
    return "falling";
  }
  return "low";
}

function buildConditions(
  marineWaves: OpenMeteoSeries,
  weather: OpenMeteoSeries,
  tide: TideCondition | null
): SnorkelConditions {
  const waveHeight = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.wave_height ?? []
  );
  const wavePeriod = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.wave_period ?? []
  );
  const waveDirection = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.wave_direction ?? []
  );
  const swellHeight = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.swell_wave_height ?? []
  );
  const swellPeriod = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.swell_wave_period ?? []
  );
  const swellDirection = pickNearestValue(
    marineWaves.time ?? [],
    marineWaves.swell_wave_direction ?? []
  );
  const tideHeight = tide?.heightMeters ?? null;
  const tideState = tide?.state ?? "unknown";

  const windSpeed = pickNearestValue(weather.time ?? [], weather.wind_speed_10m ?? []);
  const windGust = pickNearestValue(weather.time ?? [], weather.wind_gusts_10m ?? []);
  const windDirection = pickNearestValue(
    weather.time ?? [],
    weather.wind_direction_10m ?? []
  );
  const precipitation = pickNearestValue(
    weather.time ?? [],
    weather.precipitation ?? []
  );
  const cloudCover = pickNearestValue(weather.time ?? [], weather.cloud_cover ?? []);

  const combinedWaveHeight =
    waveHeight !== null
      ? waveHeight
      : swellHeight !== null
        ? swellHeight
        : null;

  return {
    waves: {
      heightMeters: combinedWaveHeight,
      periodSeconds: wavePeriod ?? swellPeriod ?? null,
      directionDegrees: waveDirection ?? swellDirection ?? null,
    },
    wind: {
      speedMetersPerSecond: windSpeed,
      gustMetersPerSecond: windGust,
      directionDegrees: windDirection,
    },
    tide: {
      heightMeters: tideHeight,
      state: tideState === "unknown" ? getTideState(tideHeight) : tideState,
    },
    weather: {
      temperatureC: null,
      precipitationMmPerHour: precipitation,
      cloudCoverPercent: cloudCover,
    },
    visibility: null,
  };
}

async function fetchOpenMeteo(
  url: string,
  params: Record<string, string>
): Promise<OpenMeteoSeries> {
  const requestUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    requestUrl.searchParams.set(key, value);
  });

  const response = await fetch(requestUrl);
  const data = (await response.json().catch(() => null)) as
    | {
        hourly?: OpenMeteoSeries;
        hourly_units?: Record<string, string>;
        error?: boolean;
        reason?: string;
      }
    | null;

  if (!response.ok) {
    const reason = data?.reason ?? "Failed to fetch Open-Meteo data";
    if (/no data|not available|land/i.test(reason)) {
      throw new Error("NO_DATA");
    }
    throw new Error(reason);
  }

  if (!data) {
    throw new Error("Failed to parse Open-Meteo response");
  }

  if (data.error) {
    throw new Error(data.reason ?? "Open-Meteo returned an error");
  }

  if (!data.hourly || !data.hourly.time) {
    throw new Error("Open-Meteo response missing hourly data");
  }

  return data.hourly;
}

export async function fetchConditions(
  coords: GeoPoint
): Promise<ConditionsResponse> {
  const baseParams = {
    latitude: coords.latitude.toString(),
    longitude: coords.longitude.toString(),
    timezone: "auto",
  };

  const marineWaveParams = {
    ...baseParams,
    hourly:
      "wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction",
  };

  const marineWaveFallbackParams = {
    ...baseParams,
    hourly: "wave_height,wave_period,wave_direction",
  };


  const weatherParams = {
    ...baseParams,
    hourly:
      "wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,cloud_cover",
  };

  const marineWaves = await fetchOpenMeteo(MARINE_URL, marineWaveParams).catch(
    async (error) => {
      if (error instanceof Error && /swell/i.test(error.message)) {
        return fetchOpenMeteo(MARINE_URL, marineWaveFallbackParams);
      }
      throw error;
    }
  );

  const [weather, tideData] = await Promise.all([
    fetchOpenMeteo(WEATHER_URL, weatherParams),
    fetchTideConditions(coords),
  ]);

  return {
    conditions: buildConditions(marineWaves, weather, tideData?.condition ?? null),
    sources: {
      marine: buildSourceInfo("Open-Meteo Marine", MARINE_URL),
      weather: buildSourceInfo("Open-Meteo Weather", WEATHER_URL),
      tide: tideData?.source,
    },
    tide: tideData?.details,
  };
}

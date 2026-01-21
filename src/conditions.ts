export type TideState = "low" | "rising" | "high" | "falling" | "unknown";

export interface WaveCondition {
  heightMeters: number | null;
  periodSeconds: number | null;
  directionDegrees: number | null;
}

export interface WindCondition {
  speedMetersPerSecond: number | null;
  gustMetersPerSecond: number | null;
  directionDegrees: number | null;
}

export interface TideCondition {
  heightMeters: number | null;
  state: TideState;
}

export interface WeatherCondition {
  temperatureC: number | null;
  precipitationMmPerHour: number | null;
  cloudCoverPercent: number | null;
}

export interface VisibilityCondition {
  rangeMeters: number | null;
}

export interface SnorkelConditions {
  waves: WaveCondition;
  wind: WindCondition;
  tide: TideCondition;
  weather: WeatherCondition;
  visibility: VisibilityCondition | null;
}

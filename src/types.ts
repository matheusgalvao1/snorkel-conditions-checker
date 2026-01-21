import type { SnorkelConditions } from "./conditions";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface LocationOption {
  id: string;
  name: string;
  placeName: string;
  coordinates: GeoPoint;
}

export interface SpotSuggestion extends LocationOption {
  distanceKm: number;
}

export interface DataSourceInfo {
  name: string;
  url: string;
  fetchedAt: string;
}

export interface TidePoint {
  time: string;
  heightMeters: number;
}

export interface TideDetails {
  points: TidePoint[];
  stationName?: string;
  datum?: string;
}

export interface ConditionsResponse {
  conditions: SnorkelConditions;
  sources: {
    marine: DataSourceInfo;
    weather: DataSourceInfo;
    tide?: DataSourceInfo;
  };
  tide?: TideDetails;
}

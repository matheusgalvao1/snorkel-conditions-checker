import type { GeoPoint, LocationOption } from "../types";

const MAPBOX_BASE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export interface GeocodeResult {
  options: LocationOption[];
}

export async function geocodeLocation(
  query: string,
  limit = 5
): Promise<GeocodeResult> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (!token) {
    throw new Error("Missing Mapbox token");
  }

  const url = new URL(`${MAPBOX_BASE_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("types", "place,locality,neighborhood,address,poi");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch geocoding results");
  }

  const data = (await response.json()) as {
    features: Array<{
      id: string;
      place_name: string;
      text: string;
      center: [number, number];
    }>;
  };

  const options = data.features.map((feature) => ({
    id: feature.id,
    name: feature.text,
    placeName: feature.place_name,
    coordinates: {
      longitude: feature.center[0],
      latitude: feature.center[1],
    },
  }));

  return { options };
}

export function formatLocationOption(option: LocationOption): string {
  return option.placeName;
}

export function distanceInKm(a: GeoPoint, b: GeoPoint): number {
  const radiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

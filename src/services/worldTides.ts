import type { DataSourceInfo, GeoPoint, TideDetails, TidePoint } from "../types";
import type { TideCondition, TideState } from "../conditions";

const WORLDTIDES_URL = "https://www.worldtides.info/api/v3";

interface WorldTidesHeightPoint {
  dt?: number;
  date?: string;
  height: number;
}

interface WorldTidesResponse {
  status?: number;
  error?: string;
  heights?: WorldTidesHeightPoint[];
  station?: string;
  responseDatum?: string;
}

export interface TideDataResult {
  condition: TideCondition;
  details: TideDetails;
  source: DataSourceInfo;
}

function getTideState(
  previous: WorldTidesHeightPoint | null,
  current: WorldTidesHeightPoint,
  next: WorldTidesHeightPoint | null
): TideState {
  if (!previous || !next) {
    return "unknown";
  }

  if (current.height > previous.height && current.height > next.height) {
    return "high";
  }
  if (current.height < previous.height && current.height < next.height) {
    return "low";
  }
  if (next.height > current.height) {
    return "rising";
  }
  if (next.height < current.height) {
    return "falling";
  }
  return "unknown";
}

function toIsoTimestamp(point: WorldTidesHeightPoint): string {
  if (point.date) {
    return point.date;
  }
  if (typeof point.dt === "number") {
    return new Date(point.dt * 1000).toISOString();
  }
  return new Date().toISOString();
}

export async function fetchTideConditions(
  coords: GeoPoint
): Promise<TideDataResult | null> {
  const apiKey = (import.meta as { env?: { VITE_TIDE_API_KEY?: string } }).env
    ?.VITE_TIDE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const url = new URL(WORLDTIDES_URL);
  url.searchParams.set("heights", "");
  url.searchParams.set("date", "today");
  url.searchParams.set("days", "1");
  url.searchParams.set("datum", "CD");
  url.searchParams.set("localtime", "");
  url.searchParams.set("lat", coords.latitude.toString());
  url.searchParams.set("lon", coords.longitude.toString());
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as WorldTidesResponse | null;
  if (!data || data.status !== 200 || !data.heights || data.heights.length === 0) {
    return null;
  }

  const points = [...data.heights].sort((a, b) => {
    const timeA = new Date(toIsoTimestamp(a)).getTime();
    const timeB = new Date(toIsoTimestamp(b)).getTime();
    return timeA - timeB;
  });

  const nowMs = Date.now();
  let bestIndex = 0;
  let bestDelta = Math.abs(new Date(toIsoTimestamp(points[0])).getTime() - nowMs);
  for (let i = 1; i < points.length; i += 1) {
    const delta = Math.abs(new Date(toIsoTimestamp(points[i])).getTime() - nowMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }

  const current = points[bestIndex];
  const previous = bestIndex > 0 ? points[bestIndex - 1] : null;
  const next = bestIndex < points.length - 1 ? points[bestIndex + 1] : null;

  const tidePoints: TidePoint[] = points
    .filter((point) => Number.isFinite(point.height))
    .map((point) => ({
      time: toIsoTimestamp(point),
      heightMeters: point.height,
    }));

  return {
    condition: {
      heightMeters: Number.isFinite(current.height) ? current.height : null,
      state: getTideState(previous, current, next),
    },
    details: {
      points: tidePoints,
      stationName: data.station,
      datum: data.responseDatum,
    },
    source: {
      name: "WorldTides",
      url: WORLDTIDES_URL,
      fetchedAt: new Date().toISOString(),
    },
  };
}

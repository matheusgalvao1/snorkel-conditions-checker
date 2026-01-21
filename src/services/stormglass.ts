import type { DataSourceInfo, GeoPoint, TideDetails, TidePoint } from "../types";
import type { TideCondition, TideState } from "../conditions";

const STORMGLASS_URL = "https://api.stormglass.io/v2/tide/sea-level/point";

interface StormglassTidePoint {
  time: string;
  sg: number;
}

export interface TideDataResult {
  condition: TideCondition;
  details: TideDetails;
  source: DataSourceInfo;
}

function getTideState(
  previous: StormglassTidePoint | null,
  current: StormglassTidePoint,
  next: StormglassTidePoint | null
): TideState {
  if (!previous || !next) {
    return "unknown";
  }

  if (current.sg > previous.sg && current.sg > next.sg) {
    return "high";
  }
  if (current.sg < previous.sg && current.sg < next.sg) {
    return "low";
  }
  if (next.sg > current.sg) {
    return "rising";
  }
  if (next.sg < current.sg) {
    return "falling";
  }
  return "unknown";
}

export async function fetchTideConditions(
  coords: GeoPoint
): Promise<TideDataResult | null> {
  const apiKey = (import.meta as { env?: { VITE_STORMGLASS_KEY?: string } }).env
    ?.VITE_STORMGLASS_KEY;
  if (!apiKey) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const start = now - 6 * 60 * 60;
  const end = now + 6 * 60 * 60;

  const url = new URL(STORMGLASS_URL);
  url.searchParams.set("lat", coords.latitude.toString());
  url.searchParams.set("lng", coords.longitude.toString());
  url.searchParams.set("params", "seaLevel");
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    data?: StormglassTidePoint[];
    meta?: {
      station?: {
        name?: string;
      };
      datum?: string;
    };
  };

  if (!data.data || data.data.length === 0) {
    return null;
  }

  const points = [...data.data].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const nowMs = Date.now();
  let bestIndex = 0;
  let bestDelta = Math.abs(new Date(points[0].time).getTime() - nowMs);
  for (let i = 1; i < points.length; i += 1) {
    const delta = Math.abs(new Date(points[i].time).getTime() - nowMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }

  const current = points[bestIndex];
  const previous = bestIndex > 0 ? points[bestIndex - 1] : null;
  const next = bestIndex < points.length - 1 ? points[bestIndex + 1] : null;

  const tidePoints: TidePoint[] = points
    .filter((point) => Number.isFinite(point.sg))
    .map((point) => ({
      time: point.time,
      heightMeters: point.sg,
    }));

  return {
    condition: {
      heightMeters: Number.isFinite(current.sg) ? current.sg : null,
      state: getTideState(previous, current, next),
    },
    details: {
      points: tidePoints,
      stationName: data.meta?.station?.name,
      datum: data.meta?.datum,
    },
    source: {
      name: "Stormglass Tide",
      url: STORMGLASS_URL,
      fetchedAt: new Date().toISOString(),
    },
  };
}

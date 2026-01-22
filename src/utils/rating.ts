import { ratingRubric, ratingTierToLabel } from "../ratingRubric";
import type { RatingLabel, RatingTier } from "../ratingRubric";
import type { SnorkelConditions } from "../conditions";

const ratingOrder: RatingTier[] = ["poor", "ok", "good", "excellent"];
const tierScore: Record<RatingTier, number> = {
  poor: 0,
  ok: 1,
  good: 2,
  excellent: 3,
};
const scoreTier: Record<number, RatingTier> = {
  0: "poor",
  1: "ok",
  2: "good",
  3: "excellent",
};

export function scoreNumeric(
  value: number | null,
  rule: typeof ratingRubric.waves.heightMeters
): RatingTier | null {
  if (value === null) {
    return null;
  }
  if (rule.direction === "lower-is-better") {
    if (value <= rule.excellentMax) return "excellent";
    if (value <= rule.goodMax) return "good";
    if (value <= rule.okMax) return "ok";
    return "poor";
  }
  if (value >= rule.excellentMin) return "excellent";
  if (value >= rule.goodMin) return "good";
  if (value >= rule.okMin) return "ok";
  return "poor";
}

export function scoreCategorical<T extends string>(
  value: T | null,
  tiers: Record<RatingTier, T[]>,
  excluded: T[] = []
): RatingTier | null {
  if (!value || excluded.includes(value)) {
    return null;
  }
  const entry = (Object.entries(tiers) as Array<[RatingTier, T[]]>).find(
    ([, values]) => values.includes(value)
  );
  return entry ? entry[0] : null;
}

export function combineRatings(ratings: Array<RatingTier | null>): RatingTier {
  const valid = ratings.filter((rating): rating is RatingTier => rating !== null);
  if (!valid.length) {
    return "ok";
  }
  return valid.reduce((worst, current) =>
    ratingOrder.indexOf(current) < ratingOrder.indexOf(worst) ? current : worst
  );
}

function combineWeightedRatings(
  entries: Array<{ tier: RatingTier | null; weight: number }>
): RatingTier {
  let totalWeight = 0;
  let weightedScore = 0;
  entries.forEach(({ tier, weight }) => {
    if (!tier || weight <= 0) {
      return;
    }
    totalWeight += weight;
    weightedScore += tierScore[tier] * weight;
  });

  if (totalWeight === 0) {
    return "ok";
  }

  const average = weightedScore / totalWeight;
  if (average >= 2.5) return "excellent";
  if (average >= 1.5) return "good";
  if (average >= 0.75) return "ok";
  return "poor";
}

export function buildRatingSummary(conditions: SnorkelConditions): {
  tier: RatingTier;
  label: RatingLabel;
  reason: string;
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    unit: string;
    textValue?: string;
    tier: RatingTier | null;
    max: number;
    explanation: string;
  }>;
} {
  const waveTier = scoreNumeric(
    conditions.waves.heightMeters,
    ratingRubric.waves.heightMeters
  );
  const windTier = scoreNumeric(
    conditions.wind.speedMetersPerSecond,
    ratingRubric.wind.speedMetersPerSecond
  );
  const gustTier = scoreNumeric(
    conditions.wind.gustMetersPerSecond,
    ratingRubric.wind.gustMetersPerSecond
  );
  const precipitationTier = scoreNumeric(
    conditions.weather.precipitationMmPerHour,
    ratingRubric.weather.precipitationMmPerHour
  );
  const cloudTier = scoreNumeric(
    conditions.weather.cloudCoverPercent,
    ratingRubric.weather.cloudCoverPercent
  );
  const sunlightTier = scoreNumeric(
    conditions.weather.shortwaveRadiationWm2,
    ratingRubric.weather.shortwaveRadiationWm2
  );
  const tideTier = scoreCategorical(
    conditions.tide.state,
    ratingRubric.tide.state.tiers,
    ratingRubric.tide.state.excluded
  );

  const visibilityTier = conditions.visibility
    ? scoreNumeric(conditions.visibility.rangeMeters, ratingRubric.visibility.rangeMeters)
    : null;

  const overall = combineWeightedRatings([
    { tier: waveTier, weight: 0.35 },
    { tier: windTier, weight: 0.25 },
    { tier: gustTier, weight: 0.1 },
    { tier: precipitationTier, weight: 0.15 },
    { tier: cloudTier, weight: 0.05 },
    { tier: sunlightTier, weight: 0.1 },
    { tier: tideTier, weight: 0.1 },
    { tier: visibilityTier, weight: 0.1 },
  ]);

  const metrics = [
    {
      id: "waves",
      label: "Wave Height",
      value: conditions.waves.heightMeters,
      unit: "m",
      tier: waveTier,
      max: 3.0, // Visual max for bar
      explanation: getWaveExplanation(conditions.waves.heightMeters)
    },
    {
      id: "wind",
      label: "Wind Speed",
      value: conditions.wind.speedMetersPerSecond,
      unit: "m/s",
      tier: windTier,
      max: 10.0,
      explanation: getWindExplanation(conditions.wind.speedMetersPerSecond)
    },
    {
      id: "tide",
      label: "Tide",
      value: conditions.tide.heightMeters,
      unit: "m",
      textValue: conditions.tide.state,
      tier: tideTier,
      max: 2.0, // Arbitrary visual max
      explanation: getTideExplanation(conditions.tide.state)
    },
    {
      id: "weather",
      label: "Precipitation",
      value: conditions.weather.precipitationMmPerHour,
      unit: "mm/hr",
      tier: precipitationTier,
      max: 5.0,
      explanation: getPrecipitationExplanation(conditions.weather.precipitationMmPerHour)
    },
    {
      id: "sunlight",
      label: "Sunlight",
      value: conditions.weather.shortwaveRadiationWm2,
      unit: "W/m2",
      tier: sunlightTier,
      max: 1000,
      explanation: getSunlightExplanation(conditions.weather.shortwaveRadiationWm2)
    },
  ];

  const reason = `Based on waves ${waveTier ?? "unknown"}, wind ${windTier ?? "unknown"}, ` +
    `tide ${tideTier ?? "unknown"}, and sunlight ${sunlightTier ?? "unknown"}.`;

  return {
    tier: overall,
    label: ratingTierToLabel[overall],
    reason,
    metrics,
  };
}

function getWaveExplanation(val: number | null) {
  if (val === null) return "Unknown conditions";
  if (val < 0.5) return "Flat and calm. Perfect for beginners.";
  if (val < 1.0) return "Small waves. Comfortable for most.";
  if (val < 1.5) return "Choppy waters. Exercise caution.";
  return "Rough seas. Not recommended.";
}

function getWindExplanation(val: number | null) {
  if (val === null) return "Unknown conditions";
  if (val < 3) return "Light breeze. Smooth surface.";
  if (val < 5) return "Moderate breeze. Some ripples.";
  if (val < 7.5) return "Windy. Expect surface chop.";
  return "Strong winds. Rough surface conditions.";
}

function getTideExplanation(state: string) {
  if (state === "high") return "Best visibility and easiest entry.";
  if (state === "rising") return "Good incoming clear water.";
  if (state === "falling") return "Currents may pull away from shore.";
  if (state === "low") return "Shallow. Watch out for coral/rocks.";
  return "Check local tide tables.";
}

function getPrecipitationExplanation(val: number | null) {
  if (val === null) return "Unknown conditions";
  if (val < 0.1) return "Dry. Good visibility.";
  if (val < 2.0) return "Light rain. Visibility might drop.";
  return "Heavy rain. Runoff may cloud water.";
}

function getSunlightExplanation(val: number | null) {
  if (val === null) return "Unknown light conditions";
  if (val >= 600) return "Bright sun. Excellent water visibility.";
  if (val >= 400) return "Good light. Visibility should be solid.";
  if (val >= 200) return "Dimmer light. Visibility may soften.";
  return "Low light. Water may look murky.";
}

export const ratingColors: Record<RatingTier, string> = {
  poor: "#dc2626",
  ok: "#f97316",
  good: "#16a34a",
  excellent: "#0ea5e9",
};

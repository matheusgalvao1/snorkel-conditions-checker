import type { TideState } from "./conditions";

export type RatingTier = "poor" | "ok" | "good" | "excellent";
export type RatingLabel = "Poor" | "OK" | "Good" | "Excellent";

export const ratingTierToLabel: Record<RatingTier, RatingLabel> = {
  poor: "Poor",
  ok: "OK",
  good: "Good",
  excellent: "Excellent",
};

export interface LowerIsBetterRule {
  direction: "lower-is-better";
  excellentMax: number;
  goodMax: number;
  okMax: number;
}

export interface HigherIsBetterRule {
  direction: "higher-is-better";
  excellentMin: number;
  goodMin: number;
  okMin: number;
}

export type NumericThresholdRule = LowerIsBetterRule | HigherIsBetterRule;

export interface CategoricalThresholdRule<T extends string> {
  tiers: Record<RatingTier, T[]>;
  excluded?: T[];
}

export interface RatingRubric {
  waves: {
    heightMeters: NumericThresholdRule;
  };
  wind: {
    speedMetersPerSecond: NumericThresholdRule;
    gustMetersPerSecond: NumericThresholdRule;
  };
  tide: {
    state: CategoricalThresholdRule<TideState>;
  };
  weather: {
    precipitationMmPerHour: NumericThresholdRule;
    cloudCoverPercent: NumericThresholdRule;
  };
  visibility: {
    rangeMeters: NumericThresholdRule;
  };
}

export const ratingRubric: RatingRubric = {
  waves: {
    heightMeters: {
      direction: "lower-is-better",
      excellentMax: 0.5,
      goodMax: 1.0,
      okMax: 1.5,
    },
  },
  wind: {
    speedMetersPerSecond: {
      direction: "lower-is-better",
      excellentMax: 3,
      goodMax: 5,
      okMax: 7.5,
    },
    gustMetersPerSecond: {
      direction: "lower-is-better",
      excellentMax: 5,
      goodMax: 7.5,
      okMax: 10,
    },
  },
  tide: {
    state: {
      tiers: {
        excellent: ["high"],
        good: ["rising"],
        ok: ["falling"],
        poor: ["low"],
      },
      excluded: ["unknown"],
    },
  },
  weather: {
    precipitationMmPerHour: {
      direction: "lower-is-better",
      excellentMax: 0.1,
      goodMax: 0.5,
      okMax: 2,
    },
    cloudCoverPercent: {
      direction: "lower-is-better",
      excellentMax: 20,
      goodMax: 50,
      okMax: 80,
    },
  },
  visibility: {
    rangeMeters: {
      direction: "higher-is-better",
      excellentMin: 20,
      goodMin: 10,
      okMin: 5,
    },
  },
};

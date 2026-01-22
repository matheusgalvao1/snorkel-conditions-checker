import React from "react";
import { ConditionsResponse } from "../types";
import { ConditionMeter } from "./ConditionMeter";
import { TideChart } from "./TideChart";
import { ratingColors } from "../utils/rating";
import { RatingTier, RatingLabel, ratingTierToLabel } from "../ratingRubric";

interface Metric {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  textValue?: string;
  tier: RatingTier | null;
  max: number;
  explanation: string;
}

interface RatingSummary {
  tier: RatingTier;
  label: RatingLabel;
  reason: string;
  tideTier: RatingTier | null;
  metrics: Metric[];
}

interface ResultsViewProps {
  data: ConditionsResponse;
  rating: RatingSummary;
  tideSummary: any;
  placeName: string;
}

export function ResultsView({ data, rating, tideSummary, placeName }: ResultsViewProps) {
  const sourcesByMetric: Record<string, string | undefined> = {
    waves: data.sources.marine.name,
    wind: data.sources.weather.name,
    tide: data.sources.tide?.name ?? data.sources.marine.name,
    weather: data.sources.weather.name,
    sunlight: data.sources.weather.name,
  };
  const tideRatingLabel = rating.tideTier ? ratingTierToLabel[rating.tideTier] : "Unknown";
  const tideRatingColor = rating.tideTier ? ratingColors[rating.tideTier] : "var(--muted)";

  return (
    <section className="results">
      <div className="summary-card">
        <div className="summary-header">
          <div>
            <p className="eyebrow">Current summary</p>
            <h2>{placeName}</h2>
            <p className="timestamp">
              Updated {new Date(data.sources.marine.fetchedAt).toLocaleTimeString()}
            </p>
          </div>
          <div
            className="rating-pill"
            style={{ backgroundColor: ratingColors[rating.tier] }}
          >
            {rating.label}
          </div>
        </div>
        <p className="rating-reason">{rating.reason}</p>
        
        {/* New Visual Meters Grid */}
        <div className="meters-grid">
            {rating.metrics.map((metric) => (
                <ConditionMeter
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    textValue={metric.textValue}
                    unit={metric.unit}
                    tier={metric.tier}
                    max={metric.max}
                    explanation={metric.explanation}
                    source={sourcesByMetric[metric.id]}
                />
            ))}
        </div>
      </div>

      <div className="details-grid">
         {/* We can keep the raw data details or remove them since we have the meters now. 
             The user said "Visual Meters" to be beginner friendly. 
             The meters cover Waves, Wind, Tide, Precip.
             The old view had: Marine (Wave H/P, Gusts, Tide H), Weather (Wind S/D, Precip, Cloud).
             
             I will keep the TideChart as it's very useful.
             I might hide the redundant text lists if the meters are good enough.
             Let's keep the TideChart and maybe a "Advanced Details" section if needed, 
             but for a cleaner look, the meters + tide chart might be enough.
          */}
          
        {data.tide && tideSummary && (
          <TideChart
            tideSummary={tideSummary}
            tideState={data.conditions.tide.state}
            tideRatingLabel={tideRatingLabel}
            tideRatingColor={tideRatingColor}
            tideSourceName={data.sources.tide?.name}
          />
        )}
      </div>
    </section>
  );
}

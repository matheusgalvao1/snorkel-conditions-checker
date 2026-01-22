import React from "react";
import { RatingTier } from "../ratingRubric";

interface ConditionMeterProps {
  label: string;
  value: number | null;
  textValue?: string;
  unit?: string;
  tier: RatingTier | null;
  max: number;
  explanation: string;
  source?: string;
}

const tierColors: Record<RatingTier, string> = {
  excellent: "var(--accent)", // Cyan/Blue
  good: "#10b981", // Green
  ok: "#f59e0b", // Amber
  poor: "#ef4444", // Red
};

const tierLabels: Record<RatingTier, string> = {
  excellent: "Excellent",
  good: "Good",
  ok: "Fair",
  poor: "Poor",
};

export function ConditionMeter({
  label,
  value,
  textValue,
  unit,
  tier,
  max,
  explanation,
  source,
}: ConditionMeterProps) {
  const percentage = value !== null ? Math.min((value / max) * 100, 100) : 0;
  const color = tier ? tierColors[tier] : "var(--muted)";
  const tierLabel = tier ? tierLabels[tier] : "Unknown";

  // For tide, if it's just text, we might not show a bar, or show a full bar with the color
  // But we passed 'value' as heightMeters for tide, so we can show it.

  return (
    <div className="condition-meter-card">
      <div className="meter-header">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
            {textValue ? (
                <span className="value-text">{textValue}</span>
            ) : value !== null ? (
                <>
                {value.toFixed(1)} <small>{unit}</small>
                </>
            ) : (
                "-"
            )}
        </span>
      </div>

      <div className="meter-footer">
        <span className="tier-badge" style={{ backgroundColor: color }}>
          {tierLabel}
        </span>
        <p className="meter-explanation">{explanation}</p>
      </div>
      {source && <p className="meter-source">Source: {source}</p>}
    </div>
  );
}

import React from "react";
import { TideCondition } from "../conditions";

interface TideSummary {
  points: { time: string; heightMeters: number }[];
  path: string;
  current: { time: string; heightMeters: number };
  currentIndex: number;
  minHeight: number;
  maxHeight: number;
  timeWindow: { time: string; heightMeters: number }[];
}

interface TideChartProps {
  tideSummary: TideSummary;
  tideState: string;
}

export function TideChart({ tideSummary, tideState }: TideChartProps) {
  return (
    <div className="detail-card tide-card">
      <h3>Tide</h3>
      <div className="tide-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={tideSummary.path} />
          <circle
            cx={
              tideSummary.points.length === 1
                ? 50
                : (tideSummary.currentIndex / (tideSummary.points.length - 1)) * 100
            }
            cy={
              100 -
              ((tideSummary.current.heightMeters - tideSummary.minHeight) /
                (tideSummary.maxHeight - tideSummary.minHeight || 1)) *
                100
            }
            r="2"
          />
        </svg>
      </div>
      <div className="tide-meta">
        <div>
          <span>Now</span>
          <strong>{tideSummary.current.heightMeters.toFixed(2)} m</strong>
        </div>
        <div>
          <span>State</span>
          <strong>{tideState}</strong>
        </div>
      </div>
      <div className="tide-times">
        {tideSummary.timeWindow.map((point) => (
          <div key={point.time}>
            <span>
              {new Date(point.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <strong>{point.heightMeters.toFixed(2)} m</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

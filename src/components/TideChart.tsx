import React, { useEffect, useRef, useState } from "react";
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
  tideRatingLabel: string;
  tideRatingColor: string;
  tideSourceName?: string;
}

export function TideChart({
  tideSummary,
  tideState,
  tideRatingLabel,
  tideRatingColor,
  tideSourceName,
}: TideChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number | null>(null);
  const chartWidth = 720;
  const chartHeight = 240;
  const padding = { top: 16, right: 12, bottom: 44, left: 48 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const range = tideSummary.maxHeight - tideSummary.minHeight || 1;
  const totalPoints = tideSummary.points.length;
  const startTime = tideSummary.points[0].time;
  const endTime = tideSummary.points[totalPoints - 1].time;
  const midHeight = tideSummary.minHeight + range / 2;

  const xForIndex = (index: number) =>
    padding.left + (totalPoints === 1 ? innerWidth / 2 : (index / (totalPoints - 1)) * innerWidth);
  const yForHeight = (height: number) =>
    padding.top + innerHeight - ((height - tideSummary.minHeight) / range) * innerHeight;

  const path = tideSummary.points
    .map((point, index) => {
      const x = xForIndex(index);
      const y = yForHeight(point.heightMeters);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const currentX = xForIndex(tideSummary.currentIndex);
  const currentY = yForHeight(tideSummary.current.heightMeters);
  const fallbackFraction = totalPoints === 1 ? 0.5 : tideSummary.currentIndex / (totalPoints - 1);
  const activeFraction = hoverFraction ?? fallbackFraction;
  const activePosition = activeFraction * (totalPoints - 1);
  const lowerIndex = Math.floor(activePosition);
  const upperIndex = Math.min(totalPoints - 1, Math.ceil(activePosition));
  const interpolation = upperIndex === lowerIndex ? 0 : activePosition - lowerIndex;
  const lowerPoint = tideSummary.points[lowerIndex];
  const upperPoint = tideSummary.points[upperIndex];
  const activeHeight =
    lowerPoint.heightMeters +
    (upperPoint.heightMeters - lowerPoint.heightMeters) * interpolation;
  const lowerTime = new Date(lowerPoint.time).getTime();
  const upperTime = new Date(upperPoint.time).getTime();
  const activeTime = new Date(lowerTime + (upperTime - lowerTime) * interpolation).toISOString();
  const activeX = hoverX ?? padding.left + activeFraction * innerWidth;
  const activeY = yForHeight(activeHeight);

  const formatHeight = (height: number) => `${height.toFixed(2)} m`;
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tickLabels = tideSummary.points
    .map((point, index) => ({
      x: xForIndex(index),
      label: formatTime(point.time),
      minutes: new Date(point.time).getMinutes(),
      index,
    }))
    .filter((tick) =>
      tick.minutes === 0 && tick.index > 0 && tick.index < totalPoints - 1
    );

  const computeTooltipLeft = (screenX: number) => {
    if (!containerRef.current) {
      return null;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const left = screenX - containerRect.left;
    return Math.min(Math.max(left, 0), containerRect.width);
  };

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) {
      return;
    }
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const localPoint = point.matrixTransform(ctm.inverse());
    const svgX = localPoint.x;
    const clampedSvgX = Math.min(Math.max(svgX, 0), chartWidth);
    const relativeX = clampedSvgX - padding.left;
    const clamped = Math.min(Math.max(relativeX, 0), innerWidth);
    const fraction = innerWidth === 0 ? 0 : clamped / innerWidth;
    setHoverFraction(fraction);
    setHoverX(clampedSvgX);
    const tooltipPoint = svg.createSVGPoint();
    tooltipPoint.x = clampedSvgX;
    tooltipPoint.y = padding.top;
    const screenPoint = tooltipPoint.matrixTransform(ctm);
    const left = computeTooltipLeft(screenPoint.x);
    if (left !== null) {
      setTooltipLeft(left);
    }
  };

  const handleLeave = () => {
    setHoverFraction(null);
    setHoverX(null);
  };

  useEffect(() => {
    if (hoverFraction !== null) {
      return;
    }
    if (!svgRef.current) {
      return;
    }
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return;
    }
    const tooltipPoint = svg.createSVGPoint();
    tooltipPoint.x = activeX;
    tooltipPoint.y = padding.top;
    const screenPoint = tooltipPoint.matrixTransform(ctm);
    const left = computeTooltipLeft(screenPoint.x);
    if (left !== null) {
      setTooltipLeft(left);
    }
  }, [hoverFraction, activeX]);

  return (
    <div className="detail-card tide-card">
      <div className="tide-header">
        <h3>🌊 Tide</h3>
        <div className="tide-header-meta">
          <span className="tide-rating" style={{ backgroundColor: tideRatingColor }}>
            {tideRatingLabel}
          </span>
          <span>Now {formatHeight(tideSummary.current.heightMeters)}</span>
          <span className="tide-state">{tideState}</span>
        </div>
      </div>
      <div className="tide-chart" ref={containerRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMinYMin meet"
          role="img"
          aria-label="Tide height chart"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          <defs>
            <linearGradient id="tideFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.25)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
            </linearGradient>
          </defs>
          <rect
            className="tide-plot-bg"
            x={padding.left}
            y={padding.top}
            width={innerWidth}
            height={innerHeight}
            rx="10"
          />
          <line
            className="tide-grid"
            x1={padding.left}
            y1={yForHeight(midHeight)}
            x2={padding.left + innerWidth}
            y2={yForHeight(midHeight)}
          />
          <line
            className="tide-axis"
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerHeight}
          />
          <line
            className="tide-axis"
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={padding.left + innerWidth}
            y2={padding.top + innerHeight}
          />
          <polygon
            className="tide-fill"
            points={`${padding.left},${padding.top + innerHeight} ${path} ${
              padding.left + innerWidth
            },${padding.top + innerHeight}`}
          />
          <polyline className="tide-line" points={path} />
          <line
            className="tide-current"
            x1={currentX}
            y1={padding.top}
            x2={currentX}
            y2={padding.top + innerHeight}
          />
          <circle className="tide-dot" cx={currentX} cy={currentY} r="4" />
          <line
            className="tide-hover"
            x1={activeX}
            y1={padding.top}
            x2={activeX}
            y2={padding.top + innerHeight}
          />
          <circle className="tide-hover-dot" cx={activeX} cy={activeY} r="5" />
          <text className="tide-axis-label" x={padding.left - 10} y={yForHeight(tideSummary.maxHeight)}>
            {formatHeight(tideSummary.maxHeight)}
          </text>
          <text className="tide-axis-label" x={padding.left - 10} y={yForHeight(midHeight)}>
            {formatHeight(midHeight)}
          </text>
          <text className="tide-axis-label" x={padding.left - 10} y={yForHeight(tideSummary.minHeight)}>
            {formatHeight(tideSummary.minHeight)}
          </text>
          {tickLabels.map((tick) => (
            <text
              key={`${tick.x}-${tick.label}`}
              className="tide-time-tick"
              x={tick.x}
              y={padding.top + innerHeight + 16}
              textAnchor="middle"
              transform={`rotate(45 ${tick.x} ${padding.top + innerHeight + 16})`}
            >
              {tick.label}
            </text>
          ))}
        </svg>
        <div className="tide-tooltip" style={{ left: tooltipLeft ?? 0 }}>
          <span>{formatTime(activeTime)}</span>
          <strong>{formatHeight(activeHeight)}</strong>
        </div>
      </div>
      <p className="tide-source">Source: {tideSourceName ?? "Unknown"}</p>
    </div>
  );
}

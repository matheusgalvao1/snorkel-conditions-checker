import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ConditionsResponse, LocationOption, SpotSuggestion } from "./types";
import type { SnorkelConditions } from "./conditions";
import { geocodeLocation, distanceInKm } from "./services/geocoding";
import { fetchConditions } from "./services/openMeteo";
import { buildRatingSummary, ratingColors } from "./utils/rating";

const emptySuggestions: SpotSuggestion[] = [];

type RequestState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "success"; data: ConditionsResponse }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

const noDataErrorMessage = "NO_DATA";

function hasConditionsData(conditions: SnorkelConditions): boolean {
  return Boolean(
    conditions.waves.heightMeters ??
      conditions.waves.periodSeconds ??
      conditions.wind.speedMetersPerSecond ??
      conditions.weather.precipitationMmPerHour ??
      conditions.weather.cloudCoverPercent ??
      conditions.tide.heightMeters
  );
}

function formatWindDirection(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) {
    return "-";
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % directions.length;
  return `${normalized.toFixed(0)}° ${directions[index]}`;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LocationOption | null>(null);
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [suggestions, setSuggestions] = useState<SpotSuggestion[]>([]);
  const [state, setState] = useState<RequestState>({ status: "idle" });
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setOptions([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void geocodeLocation(query.trim(), 5)
        .then(({ options: locations }) => {
          setOptions(locations);
        })
        .catch(() => {
          setOptions([]);
        });
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);


  const rating = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }
    return buildRatingSummary(state.data.conditions);
  }, [state]);

  const tideSummary = useMemo(() => {
    if (state.status !== "success" || !state.data.tide) {
      return null;
    }
    const points = state.data.tide.points;
    if (!points.length) {
      return null;
    }
    const nowMs = Date.now();
    let closestIndex = 0;
    let closestDelta = Math.abs(new Date(points[0].time).getTime() - nowMs);
    for (let i = 1; i < points.length; i += 1) {
      const delta = Math.abs(new Date(points[i].time).getTime() - nowMs);
      if (delta < closestDelta) {
        closestDelta = delta;
        closestIndex = i;
      }
    }
    const heights = points.map((point) => point.heightMeters);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const range = maxHeight - minHeight || 1;
    const path = points
      .map((point, index) => {
        const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
        const y = 100 - ((point.heightMeters - minHeight) / range) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
    const windowStart = Math.max(0, closestIndex - 2);
    const windowEnd = Math.min(points.length, closestIndex + 3);
    const timeWindow = points.slice(windowStart, windowEnd);
    return {
      points,
      path,
      current: points[closestIndex],
      currentIndex: closestIndex,
      minHeight,
      maxHeight,
      timeWindow,
    };
  }, [state]);

  async function runSearch(searchQuery: string) {
    if (!searchQuery.trim()) {
      return;
    }
    setState({ status: "loading", message: "Searching nearby spots..." });
    setSuggestions(emptySuggestions);

    try {
      const { options: locations } = await geocodeLocation(searchQuery.trim(), 6);
      setOptions(locations);
      const match = locations.find(
        (option) => option.placeName === searchQuery.trim()
      );
      const chosen = match ?? locations[0] ?? null;
      setSelected(chosen);

      if (!chosen) {
        setState({
          status: "empty",
          message: "No matches found. Try another place name.",
        });
        return;
      }

      await fetchAndScore(chosen, locations);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Search failed.",
      });
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query);
  }

  async function fetchAndScore(
    location: LocationOption,
    fallback: LocationOption[]
  ) {
    setState({ status: "loading", message: "Checking live conditions..." });
    try {
      const data = await fetchConditions(location.coordinates);
      const hasData = hasConditionsData(data.conditions);

      if (!hasData) {
        throw new Error(noDataErrorMessage);
      }

      setState({ status: "success", data });
      setSuggestions(emptySuggestions);
    } catch (error) {
      if (error instanceof Error && error.message === noDataErrorMessage) {
        setState({
          status: "loading",
          message: "Looking for nearby spots with data...",
        });
        const nearby = await findNearbySpotsWithData(location, fallback);
        if (nearby.length) {
          setSuggestions(nearby);
          setState({
            status: "empty",
            message: "No data for that spot. Try a nearby option.",
          });
          return;
        }

        setState({
          status: "empty",
          message: "No nearby spots with data. Try another location.",
        });
        return;
      }

      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch conditions. Please try again.",
      });
    }
  }

  async function findNearbySpotsWithData(
    origin: LocationOption,
    fallback: LocationOption[]
  ): Promise<SpotSuggestion[]> {
    const candidates = fallback
      .filter((option) => option.id !== origin.id)
      .map((option) => ({
        ...option,
        distanceKm: distanceInKm(origin.coordinates, option.coordinates),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const results: SpotSuggestion[] = [];
    for (const candidate of candidates) {
      try {
        const response = await fetchConditions(candidate.coordinates);
        if (hasConditionsData(response.conditions)) {
          results.push(candidate);
        }
      } catch (candidateError) {
        continue;
      }
      if (results.length >= 3) {
        break;
      }
    }
    return results;
  }

  async function handleSuggestionClick(option: SpotSuggestion) {
    setSelected(option);
    await fetchAndScore(option, options.length ? options : [option]);
  }

  function handleRetry() {
    if (!selected) {
      return;
    }
    void fetchAndScore(selected, options);
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setState({
        status: "error",
        message: "Geolocation is not supported by your browser.",
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          setState({ status: "loading", message: "Finding your location..." });

          const reverseGeoQuery = `${longitude},${latitude}`;
          const { options: locations } = await geocodeLocation(reverseGeoQuery, 1);

          if (locations.length === 0) {
            setState({
              status: "error",
              message: "Could not identify your location. Please try searching manually.",
            });
            setIsGettingLocation(false);
            return;
          }

          const currentLocation = locations[0];
          setQuery(currentLocation.placeName);
          setSelected(currentLocation);
          setIsGettingLocation(false);

          await fetchAndScore(currentLocation, locations);
        } catch (error) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to get your location.",
          });
          setIsGettingLocation(false);
        }
      },
      (error) => {
        let message = "Failed to get your location.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }

        setState({ status: "error", message });
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Snorkel Conditions Checker</p>
          <h1>Find your calm patch of water.</h1>
          <p className="lede">
            Search a shoreline and instantly see real-time wave, tide, wind, and
            weather factors with a clear rating.
          </p>
        </div>
        <div className="hero-card">
          <form className="search" onSubmit={handleSearch}>
            <label htmlFor="location">Location</label>
            <div className="search-row">
              <input
                id="location"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Hanauma Bay, HI"
                list="location-options"
              />
              <button
                type="button"
                className="location-button"
                onClick={handleUseCurrentLocation}
                disabled={isGettingLocation || state.status === "loading"}
                title="Use my current location"
              >
                📍
              </button>
              <button type="submit">Check</button>
            </div>
            <datalist id="location-options">
              {options.map((option) => (
                <option key={option.id} value={option.placeName} />
              ))}
            </datalist>
          </form>
          {state.status === "loading" && (
            <div className="state">{state.message}</div>
          )}
          {state.status === "error" && (
            <div className="state error">
              <p>{state.message}</p>
              <button type="button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          )}
          {state.status === "empty" && (
            <div className="state">
              <p>{state.message}</p>
              {suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSuggestionClick(option)}
                    >
                      {option.name} · {option.distanceKm.toFixed(1)} km
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {state.status === "success" && rating && (
        <section className="results">
          <div className="summary-card">
            <div className="summary-header">
              <div>
                <p className="eyebrow">Current summary</p>
                <h2>{selected?.placeName ?? "Selected spot"}</h2>
                <p className="timestamp">
                  Updated {new Date(state.data.sources.marine.fetchedAt).toLocaleTimeString()}
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
            <div className="metrics">
              {rating.metrics.map((metric) => (
                <div key={metric.label} className="metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="details-grid">
            <div className="detail-card">
              <h3>Marine</h3>
              <ul>
                <li>Wave height: {state.data.conditions.waves.heightMeters ?? "-"} m</li>
                <li>Wave period: {state.data.conditions.waves.periodSeconds ?? "-"} s</li>
                <li>Wind gusts: {state.data.conditions.wind.gustMetersPerSecond ?? "-"} m/s</li>
                <li>Tide height: {state.data.conditions.tide.heightMeters ?? "-"} m</li>
              </ul>
              <p className="source">
                Source: {state.data.sources.marine.name} · {state.data.sources.marine.fetchedAt}
              </p>
            </div>
            {state.data.tide && tideSummary && (
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
                    <strong>{state.data.conditions.tide.state}</strong>
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
                {state.data.tide.stationName && (
                  <p className="source">Station: {state.data.tide.stationName}</p>
                )}
                {state.data.tide.datum && (
                  <p className="source">Datum: {state.data.tide.datum}</p>
                )}
                {state.data.sources.tide && (
                  <p className="source">
                    Source: {state.data.sources.tide.name} · {state.data.sources.tide.fetchedAt}
                  </p>
                )}
              </div>
            )}
            <div className="detail-card">
              <h3>Weather</h3>
              <ul>
                <li>Wind speed: {state.data.conditions.wind.speedMetersPerSecond ?? "-"} m/s</li>
                <li>
                  Wind direction: {formatWindDirection(state.data.conditions.wind.directionDegrees)}
                </li>
                <li>Precipitation: {state.data.conditions.weather.precipitationMmPerHour ?? "-"} mm/hr</li>
                <li>Cloud cover: {state.data.conditions.weather.cloudCoverPercent ?? "-"}%</li>
              </ul>
              <p className="source">
                Source: {state.data.sources.weather.name} · {state.data.sources.weather.fetchedAt}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

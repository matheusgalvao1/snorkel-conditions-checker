import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ConditionsResponse, LocationOption, SpotSuggestion } from "./types";
import type { SnorkelConditions } from "./conditions";
import { geocodeLocation, distanceInKm } from "./services/geocoding";
import { fetchConditions } from "./services/openMeteo";
import { buildRatingSummary } from "./utils/rating";
import { SearchSection } from "./components/SearchSection";
import { ResultsView } from "./components/ResultsView";

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
      <SearchSection
        query={query}
        setQuery={setQuery}
        options={options}
        isGettingLocation={isGettingLocation}
        handleSearch={handleSearch}
        handleUseCurrentLocation={handleUseCurrentLocation}
        status={state.status}
        message={state.status === "loading" || state.status === "error" || state.status === "empty" ? state.message : undefined}
        handleRetry={handleRetry}
        suggestions={suggestions}
        handleSuggestionClick={handleSuggestionClick}
      />

      {state.status === "success" && rating && (
        <ResultsView
          data={state.data}
          rating={rating}
          tideSummary={tideSummary}
          placeName={selected?.placeName ?? "Selected spot"}
        />
      )}
    </div>
  );
}

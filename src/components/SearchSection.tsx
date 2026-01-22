import React, { FormEvent } from "react";
import { LocationOption, SpotSuggestion } from "../types";

interface SearchSectionProps {
  query: string;
  setQuery: (q: string) => void;
  options: LocationOption[];
  isGettingLocation: boolean;
  handleSearch: (e: FormEvent<HTMLFormElement>) => void;
  handleUseCurrentLocation: () => void;
  status: "idle" | "loading" | "success" | "empty" | "error";
  message?: string;
  handleRetry: () => void;
  suggestions: SpotSuggestion[];
  handleSuggestionClick: (option: SpotSuggestion) => void;
}

export function SearchSection({
  query,
  setQuery,
  options,
  isGettingLocation,
  handleSearch,
  handleUseCurrentLocation,
  status,
  message,
  handleRetry,
  suggestions,
  handleSuggestionClick,
}: SearchSectionProps) {
  return (
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
              disabled={isGettingLocation || status === "loading"}
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
        {status === "loading" && <div className="state">{message}</div>}
        {status === "error" && (
          <div className="state error">
            <p>{message}</p>
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
        {status === "empty" && (
          <div className="state">
            <p>{message}</p>
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
  );
}

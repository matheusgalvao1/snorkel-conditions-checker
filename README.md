# Snorkel Conditions Checker

Quickly check snorkeling conditions for a location using live marine, weather, and tide data. The app searches locations, fetches current conditions, and summarizes them with a 4-tier rating.

## Features
- Location search with autocomplete and nearby spot fallbacks
- Real-time marine (waves) and weather (wind, precip, cloud) data via Open-Meteo
- Tide height and state via WorldTides
- 4-tier rating summary with key metrics
- Friendly loading, empty, and error states

## Requirements
- Node.js 18+
- Mapbox token for geocoding
- WorldTides API key for tide data

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Create `.env` from the example and add keys
   ```bash
   cp .env.example .env
   ```
3. Add your keys in `.env`
   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_token
   VITE_TIDE_API_KEY=your_worldtides_key
   ```
4. Start the dev server
   ```bash
   npm run dev
   ```

## Docker
1. Ensure your `.env` file is present (see setup above)
2. Build and run the container
   ```bash
   ./start.sh
   ```
3. Open `http://localhost:4173`

## Scripts
- `npm run dev` - Start the Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run typecheck` - Run TypeScript type checks

## Data Sources
- Mapbox Geocoding API
- Open-Meteo Marine + Weather APIs
- WorldTides API

## Notes
- Tide data requires a WorldTides key; without it, tide stays `unknown`.
- Optional: you can override Open-Meteo endpoints with `VITE_OPEN_METEO_MARINE_URL` and `VITE_OPEN_METEO_WEATHER_URL`.

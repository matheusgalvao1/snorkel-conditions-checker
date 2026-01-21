# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript single-page app. Source lives in `src/` with
entry points at `src/main.tsx` (React mount) and `src/App.tsx` (UI + data flow).
Domain logic is split into small modules:
- `src/services/` for external API calls (Mapbox geocoding, Open-Meteo, Stormglass).
- `src/utils/` for pure helpers (rating calculations).
- `src/types.ts` and `src/conditions.ts` for shared types and condition models.
- `src/styles.css` for global styling. Build config is in `vite.config.ts`.

## Build, Test, and Development Commands
- `npm install` to install dependencies.
- `npm run dev` to start the Vite dev server.
- `npm run build` to create a production build.
- `npm run preview` to serve the production build locally.
- `npm run typecheck` to run TypeScript checks.
- `npm test` currently prints a placeholder message (no tests configured).

## Coding Style & Naming Conventions
Follow the existing formatting in `src/` (2-space indentation and explicit
imports). Use `PascalCase` for React components (`App.tsx`), `camelCase` for
functions and variables, and `VITE_`-prefixed `UPPER_SNAKE_CASE` for env vars.
No formatter or linter is configured, so keep changes minimal and consistent.

## Testing Guidelines
There is no automated test framework yet. Use `npm run typecheck` and manual
verification via `npm run dev`. If you add tests later, document the framework,
conventions, and how to run them here.

## Commit & Pull Request Guidelines
The git history is empty, so no commit convention exists yet. Use short,
imperative messages (e.g., "Add tide summary chart") and keep commits focused.
For PRs, include a clear description, testing steps, and screenshots for UI
changes. Link related issues if applicable.

## Configuration & Secrets
Create `.env` from `.env.example` and set `VITE_MAPBOX_TOKEN` and
`VITE_STORMGLASS_KEY`. Optional overrides include
`VITE_OPEN_METEO_MARINE_URL` and `VITE_OPEN_METEO_WEATHER_URL`. Do not commit
real credentials.

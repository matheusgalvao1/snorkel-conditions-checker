# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript app.
  - `src/components/` holds UI components (PascalCase filenames like `SearchSection.tsx`).
  - `src/services/` contains API clients for geocoding, weather, and tides.
  - `src/utils/`, `src/conditions.ts`, and `src/ratingRubric.ts` hold shared logic and rules.
- `src/styles.css` defines the global styles.
- `index.html`, `vite.config.ts`, and `tsconfig.json` configure Vite and TypeScript.
- `start.sh` and `Dockerfile` support the Docker workflow.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` builds the production bundle.
- `npm run preview` serves the production build locally.
- `npm run typecheck` runs TypeScript checks without emitting.
- `npm test` runs Jest (no tests are currently committed).
- `./start.sh` builds and runs the Docker image (expects a `.env` file).

## Coding Style & Naming Conventions
- Use 2-space indentation, double quotes, and semicolons to match existing files.
- React components are PascalCase; variables and functions are camelCase.
- Keep files near their domain (services in `src/services`, UI in `src/components`).

## Testing Guidelines
- Tests run via Jest (`npm test`) with `ts-jest`.
- Prefer `*.test.ts` or `*.test.tsx` naming and colocate with the module or in `src/__tests__/`.
- If adding new logic, include unit tests for rating and data-parsing utilities.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and descriptive (e.g., "Add Dockerfile and start script").
- PRs should include a concise summary, testing notes, and screenshots for UI changes.
- Link related issues and call out any changes to required environment variables.

## Configuration & Secrets
- Copy `.env.example` to `.env` and set `VITE_MAPBOX_TOKEN` and `VITE_TIDE_API_KEY`.
- Optional overrides: `VITE_OPEN_METEO_MARINE_URL` and `VITE_OPEN_METEO_WEATHER_URL`.
- Never commit real API keys.

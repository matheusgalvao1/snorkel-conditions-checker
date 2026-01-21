interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_OPEN_METEO_BASE_URL?: string;
  readonly VITE_OPEN_METEO_MARINE_URL?: string;
  readonly VITE_OPEN_METEO_WEATHER_URL?: string;
  readonly VITE_STORMGLASS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

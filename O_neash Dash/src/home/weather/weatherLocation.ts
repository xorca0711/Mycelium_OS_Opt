export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

const STORAGE_KEY = "oneash-weather-location";
const CHANGE_EVENT = "oneash-weather-location-changed";

export function getWeatherLocation(): WeatherLocation | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === "string" && Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lon)) {
      return parsed as WeatherLocation;
    }
  } catch {
    /* corrupt value — treat as unset */
  }
  return null;
}

export function setWeatherLocation(location: WeatherLocation): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearWeatherLocation(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Local writes and other windows both update mounted weather/settings views. */
export function subscribeWeatherLocation(listener: (location: WeatherLocation | null) => void): () => void {
  const changed = () => listener(getWeatherLocation());
  const stored = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) changed();
  };
  window.addEventListener(CHANGE_EVENT, changed);
  window.addEventListener('storage', stored);
  return () => {
    window.removeEventListener(CHANGE_EVENT, changed);
    window.removeEventListener('storage', stored);
  };
}

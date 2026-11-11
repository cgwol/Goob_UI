/**
 * Local config file for Goob UI.
 * Settings, games, and apps are stored in config.json inside the app data
 * directory so they survive updates. Tile images stay as files in tiles/.
 * On first run, anything still in localStorage is migrated into the file.
 */
import { invoke } from "@tauri-apps/api/core";

export type ConfigSettings = {
  sensitivity: string;
  theme: string;
  volume: string;
  windowMode: string;
  cursorMode: string;
};

export type LibraryItem = {
  id: string;
  name: string;
  path: string;
  steamId?: string;
  image?: string;
  lastPlayed?: number;
};

export type GoobConfig = {
  version: 1;
  settings: ConfigSettings;
  games: LibraryItem[];
  apps: LibraryItem[];
};

const DEFAULTS: ConfigSettings = {
  sensitivity: "Medium",
  theme: "Dark",
  volume: "Medium",
  windowMode: "Windowed fullscreen",
  cursorMode: "Off When Using a Controller",
};

let config: GoobConfig = empty();
let ready = false;
const listeners = new Set<() => void>();

function empty(): GoobConfig {
  return { version: 1, settings: { ...DEFAULTS }, games: [], apps: [] };
}

function emit() {
  listeners.forEach((fn) => fn());
}

function migrateFromLocalStorage(): GoobConfig {
  const read = (key: string, fallback: string) => localStorage.getItem(key) || fallback;
  const list = (key: string): LibraryItem[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  };
  return {
    version: 1,
    settings: {
      sensitivity: read("sensitivity", DEFAULTS.sensitivity),
      theme: read("theme", DEFAULTS.theme),
      volume: read("volume", DEFAULTS.volume),
      windowMode: read("window-mode", DEFAULTS.windowMode),
      cursorMode: read("cursor-mode", DEFAULTS.cursorMode),
    },
    games: list("games"),
    apps: list("apps"),
  };
}

async function persist() {
  await invoke("save_config", { contents: JSON.stringify(config, null, 2) });
}

/** Load the config file, or migrate from localStorage if it does not exist yet. */
export async function initConfig() {
  if (ready) return config;
  try {
    const raw = await invoke<string>("load_config");
    if (raw && raw.trim()) {
      const parsed = JSON.parse(raw) as GoobConfig;
      config = {
        version: 1,
        settings: { ...DEFAULTS, ...(parsed.settings ?? {}) },
        games: Array.isArray(parsed.games) ? parsed.games : [],
        apps: Array.isArray(parsed.apps) ? parsed.apps : [],
      };
    } else {
      config = migrateFromLocalStorage();
      await persist();
    }
  } catch (err) {
    console.error("config load failed", err);
    config = migrateFromLocalStorage();
  }
  ready = true;
  emit();
  return config;
}

export function getConfig(): GoobConfig {
  return config;
}

export function onConfig(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function saveSettings(next: Partial<ConfigSettings>) {
  config = { ...config, settings: { ...config.settings, ...next } };
  emit();
  await persist();
}

export async function saveGames(games: LibraryItem[]) {
  config = { ...config, games };
  emit();
  await persist();
}

export async function saveApps(apps: LibraryItem[]) {
  config = { ...config, apps };
  emit();
  await persist();
}

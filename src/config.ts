export type GoobConfig = {
  version: 1;
  settings: ConfigSettings;
  games: LibraryItem[];
  apps: LibraryItem[];
};

export async function initConfig() {
  const raw = await invoke<string>("load_config");
  if (raw && raw.trim()) {
    config = JSON.parse(raw);
  } else {
    config = migrateFromLocalStorage(); // first run only
    await persist();
  }
}

export async function saveSettings(next: Partial<ConfigSettings>) { /* writes the file */ }
export async function saveGames(games: LibraryItem[]) { /* writes the file */ }
export async function saveApps(apps: LibraryItem[]) { /* writes the file */ }
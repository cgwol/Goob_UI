/**
 * Simple tracker for apps/games launched from Goob UI.
 * Stores them in localStorage and lets the side menu show only currently running ones.
 */
export type RunningItem = {
  id: string;
  name: string;
  path: string;
  processName: string;
  steamId?: string;
  image?: string;
};

const KEY = "goob-running-apps";

function load(): RunningItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list: RunningItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addRunning(item: RunningItem) {
  const list = load().filter((x) => x.id !== item.id);
  list.unshift(item);
  save(list.slice(0, 12)); // keep a reasonable max
}

export function getRunning(): RunningItem[] {
  return load();
}

export function setRunning(list: RunningItem[]) {
  save(list);
}

/** Derive a likely process name from a path (exe/bat name). */
export function processNameFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() || path;
  return base.replace(/\.(exe|bat)$/i, "") + ".exe";
}
/**
 * Central settings store for Goob UI.
 * Manages sensitivity (deadzone), theme, system volume, window mode, and resolution.
 * All values are persisted to localStorage. Theme is applied by setting a class on <html>.
 * Window mode and resolution are applied through Tauri window APIs, with special handling
 * for "Windowed fullscreen" (borderless cover of the monitor when the chosen resolution fills it).
 */
import { useEffect, useState } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";

export type Sensitivity = "Low" | "Medium" | "High";
export type Theme = "Dark" | "Light" | "Forest" | "Ocean" | "Black";
export type Volume = "Off" | "Low" | "Medium" | "High";
export type WindowMode = "Windowed fullscreen" | "Fullscreen" | "Windowed";
export type Resolution = "720p" | "1080p" | "1440p" | "4K";
export type CursorMode = "Off at All Times" | "Off When Using a Controller" | "On At All Times";

const KEY = "sensitivity";
const THEME_KEY = "theme";
const THEMES: Theme[] = ["Dark", "Light", "Forest", "Ocean", "Black"];
const VOLUME_KEY = "volume";
const VOLUMES: Volume[] = ["Off", "Low", "Medium", "High"];
const WINDOW_KEY = "window-mode";
const WINDOW_MODES: WindowMode[] = ["Windowed fullscreen", "Fullscreen", "Windowed"];
const RES_KEY = "resolution";
const RESOLUTIONS: Resolution[] = ["720p", "1080p", "1440p", "4K"];
const RES_SIZE: Record<Resolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4K": { width: 3840, height: 2160 },
};
const CURSOR_KEY = "cursor-mode";
const CURSOR_MODES: CursorMode[] = [
  "Off at All Times",
  "Off When Using a Controller",
  "On At All Times",
];

let sensitivity: Sensitivity = load();
let theme: Theme = loadTheme();
const listeners = new Set<() => void>();
let volume: Volume = loadVolume();
let windowMode: WindowMode = loadWindow();
let resolution: Resolution = loadResolution();
let cursorMode: CursorMode = loadCursorMode();

function load(): Sensitivity {
  const saved = localStorage.getItem(KEY);
  return saved === "Low" || saved === "High" ? saved : "Medium";
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.includes(saved as Theme) ? (saved as Theme) : "Dark";
}

function loadResolution(): Resolution {
  const saved = localStorage.getItem(RES_KEY);
  return RESOLUTIONS.includes(saved as Resolution) ? (saved as Resolution) : "720p";
}

function emit() {
  listeners.forEach((fn) => fn());
}

// Apply the current theme by setting a CSS class on the document element
function applyTheme() {
  document.documentElement.className = `theme-${theme.toLowerCase()}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSensitivity() {
  return sensitivity;
}

// Map the sensitivity setting to a stick deadzone value used by navigation loops
export function getDeadzone() {
  if (sensitivity === "High") return 0.35;
  if (sensitivity === "Low") return 0.75;
  return 0.55;
}

export function getTheme() {
  return theme;
}

export function useSensitivity() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return sensitivity;
}

export function useTheme() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return theme;
}

export function setSensitivity(next: Sensitivity) {
  sensitivity = next;
  localStorage.setItem(KEY, sensitivity);
  emit();
}

export function setTheme(next: Theme) {
  theme = next;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  emit();
}

function loadVolume(): Volume {
  const saved = localStorage.getItem(VOLUME_KEY);
  return VOLUMES.includes(saved as Volume) ? (saved as Volume) : "Medium";
}

export function getVolume() {
  return volume;
}

export function setVolume(next: Volume) {
  volume = next;
  localStorage.setItem(VOLUME_KEY, volume);
  emit();
}

export function useVolume() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return volume;
}

// Convert the volume setting into a 0-1 gain multiplier for the audio system
export function volumeLevel() {
  if (volume === "Off") return 0;
  if (volume === "Low") return 0.25;
  if (volume === "High") return 1;
  return 0.55;
}

function loadWindow(): WindowMode {
  const saved = localStorage.getItem(WINDOW_KEY);
  return WINDOW_MODES.includes(saved as WindowMode) ? (saved as WindowMode) : "Windowed fullscreen";
}

export function getWindowMode() {
  return windowMode;
}

export function getResolution() {
  return resolution;
}

export function setResolution(next: Resolution) {
  resolution = next;
  localStorage.setItem(RES_KEY, next);
  emit();
  if (windowMode !== "Fullscreen") void applyWindowMode(windowMode);
}

export function useResolution() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return resolution;
}

// Decide the target pixel size for the chosen resolution, clamped to the monitor.
// 'fills' is true when the chosen resolution essentially covers the whole monitor.
function targetSize(monitor?: { size: { width: number; height: number } } | null) {
  const picked = RES_SIZE[resolution];
  if (!monitor) return { ...picked, fills: false };
  const width = Math.min(picked.width, monitor.size.width);
  const height = Math.min(picked.height, monitor.size.height);
  const fills = width >= monitor.size.width - 8 && height >= monitor.size.height - 8;
  return { width, height, fills };
}

// Borderless window that completely covers the current monitor (slightly oversized to hide edges)
async function coverMonitor() {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  if (!monitor) return;

  const pad = Math.round(8 * monitor.scaleFactor);
  await win.setDecorations(false);
  await win.setShadow(false).catch(() => {});
  await win.setResizable(false);
  await win.unmaximize();
  await wait(80);

  const pos = new PhysicalPosition(monitor.position.x - pad, monitor.position.y - pad);
  const size = new PhysicalSize(monitor.size.width + pad * 2, monitor.size.height + pad * 2);

  await win.setAlwaysOnTop(true);
  await win.setPosition(pos);
  await win.setSize(size);
  await wait(50);
  await win.setPosition(pos);
  await win.setSize(size);
}

// Place a sized window (decorated or borderless) centered on the monitor
async function placeSized(decorated: boolean) {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  const { width, height } = targetSize(monitor);

  await win.setAlwaysOnTop(false);
  await win.unmaximize();
  await win.setDecorations(decorated);
  await win.setShadow(decorated).catch(() => {});
  await win.setResizable(decorated);
  await wait(80);
  await win.setSize(new PhysicalSize(width, height));
  await wait(80);

  if (!monitor) {
    await win.center();
    return;
  }

  const outer = await win.outerSize().catch(() => null);
  const w = outer?.width ?? width;
  const h = outer?.height ?? height;
  const x = monitor.position.x + (monitor.size.width - w) / 2;
  const y = monitor.position.y + (monitor.size.height - h) / 2;
  await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
}

/**
 * Apply the requested window mode using Tauri window APIs.
 * Fullscreen uses the native fullscreen flag.
 * Windowed fullscreen covers the monitor when the resolution fills it, otherwise centers a borderless window.
 * Windowed is a normal decorated, resizable window of the chosen size.
 */
export async function applyWindowMode(mode: WindowMode) {
  const win = getCurrentWindow();

  if (mode === "Fullscreen") {
    await win.setAlwaysOnTop(false);
    await win.setDecorations(false);
    await win.setFullscreen(true);
    return;
  }

  await win.setFullscreen(false);
  await wait(80);

  if (mode === "Windowed fullscreen") {
    const monitor = await currentMonitor();
    if (targetSize(monitor).fills) {
      await coverMonitor();
      return;
    }
    await placeSized(false);
    return;
  }

  await placeSized(true);
}

export async function setWindowMode(next: WindowMode) {
  windowMode = next;
  localStorage.setItem(WINDOW_KEY, next);
  emit();
  await applyWindowMode(next);
}

export function useWindowMode() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return windowMode;
}

// Apply theme immediately on module load
applyTheme();

// When the window regains focus in Windowed fullscreen mode and the resolution fills the monitor,
// re-apply the cover so the window stays edge-to-edge after alt-tabbing.
getCurrentWindow().onFocusChanged(({ payload: focused }) => {
  if (getWindowMode() !== "Windowed fullscreen") return;
  if (!focused) {
    void getCurrentWindow().setAlwaysOnTop(false);
    return;
  }
  void (async () => {
    const monitor = await currentMonitor();
    if (targetSize(monitor).fills) await coverMonitor();
  })();
});

function loadCursorMode(): CursorMode {
  const saved = localStorage.getItem(CURSOR_KEY);
  return CURSOR_MODES.includes(saved as CursorMode)
    ? (saved as CursorMode)
    : "Off When Using a Controller";
}

export function getCursorMode() {
  return cursorMode;
}

export function setCursorMode(next: CursorMode) {
  cursorMode = next;
  localStorage.setItem(CURSOR_KEY, next);
  emit();
}

export function useCursorMode() {
  // same pattern as the other settings hooks
  return cursorMode;
}
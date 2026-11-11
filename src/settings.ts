/**
 * Central settings store for Goob UI.
 * Manages sensitivity (deadzone), theme, system volume, window mode, and resolution.
 * All values are persisted to localStorage. Theme is applied by setting a class on <html>.
 * Window mode and resolution are stored only for now — applying them is handled separately.
 */
import { useEffect, useState } from "react";

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

export function setWindowMode(next: WindowMode) {
  windowMode = next;
  localStorage.setItem(WINDOW_KEY, next);
  emit();
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
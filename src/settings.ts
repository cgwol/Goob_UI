/**
 * Central settings store for Goob UI.
 * Manages sensitivity (deadzone), theme, system volume, and window mode.
 * All values are persisted to localStorage. Theme is applied by setting a class on <html>.
 * Window mode controls the window: fullscreen, borderless cover, or a normal window.
 */
import { useEffect, useState } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { getConfig, saveSettings, onConfig } from "./config";

export type Sensitivity = "Low" | "Medium" | "High";
export type Theme = "Dark" | "Light" | "Forest" | "Ocean" | "Black" | "Goobing";
export type Volume = "Off" | "Low" | "Medium" | "High";
export type WindowMode = "Windowed fullscreen" | "Fullscreen" | "Windowed";
export type CursorMode = "Off at All Times" | "Off When Using a Controller" | "On At All Times";

const KEY = "sensitivity";
const THEME_KEY = "theme";
const THEMES: Theme[] = ["Dark", "Light", "Forest", "Ocean", "Black" , "Goobing"];
const VOLUME_KEY = "volume";
const VOLUMES: Volume[] = ["Off", "Low", "Medium", "High"];
const WINDOW_KEY = "window-mode";
const WINDOW_MODES: WindowMode[] = ["Windowed fullscreen", "Fullscreen", "Windowed"];
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
let cursorMode: CursorMode = loadCursorMode();

function load(): Sensitivity {
  const saved = localStorage.getItem(KEY);
  return saved === "Low" || saved === "High" ? saved : "Medium";
}

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.includes(saved as Theme) ? (saved as Theme) : "Dark";
}

function emit() {
  listeners.forEach((fn) => fn());
}

/** Pull settings out of the local config file (called after it loads). */
export function applyConfigSettings() {
  const s = getConfig().settings;
  if (s.sensitivity === "Low" || s.sensitivity === "Medium" || s.sensitivity === "High") {
    sensitivity = s.sensitivity;
  }
  if (THEMES.includes(s.theme as Theme)) theme = s.theme as Theme;
  if (VOLUMES.includes(s.volume as Volume)) volume = s.volume as Volume;
  if (WINDOW_MODES.includes(s.windowMode as WindowMode)) windowMode = s.windowMode as WindowMode;
  if (CURSOR_MODES.includes(s.cursorMode as CursorMode)) cursorMode = s.cursorMode as CursorMode;
  applyTheme();
  emit();
}

onConfig(applyConfigSettings);

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
  void saveSettings({ sensitivity: next });
}

export function setTheme(next: Theme) {
  theme = next;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  emit();
  void saveSettings({ theme: next });
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
  void saveSettings({ volume: next });
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply the current window mode.
 * Fullscreen: native fullscreen.
 * Windowed fullscreen: borderless window covering the monitor.
 * Windowed: decorated, resizable 1280×720 window, centered.
 */
export async function applyWindowMode(mode: WindowMode) {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();

  if (mode === "Fullscreen") {
    await win.setAlwaysOnTop(false);
    await win.setDecorations(false);
    await win.setFullscreen(true);
    return;
  }

  await win.setFullscreen(false);
  await wait(60);

  if (mode === "Windowed fullscreen") {
    await win.setAlwaysOnTop(false);
    await win.setDecorations(false);
    await win.setResizable(false);
    await win.setShadow(false).catch(() => { });
    await win.unmaximize();
    if (monitor) {
      await win.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
      await win.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
    }
    return;
  }

  // Windowed: a normal window, centered
  // Windowed: a normal window, centered, locked to 16:9
  await win.setAlwaysOnTop(false);
  await win.setDecorations(true);
  await win.setResizable(true);
  await win.setShadow(true).catch(() => { });
  await win.unmaximize();
  await win.setMinSize(new PhysicalSize(960, 540)).catch(() => { });
  await win.setSize(new PhysicalSize(1280, 720));
  await win.center();
}

export async function setWindowMode(next: WindowMode) {
  windowMode = next;
  localStorage.setItem(WINDOW_KEY, next);
  emit();
  void saveSettings({ windowMode: next });
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
  void saveSettings({ cursorMode: next });
}

export function useCursorMode() {
  // same pattern as the other settings hooks
  return cursorMode;
}
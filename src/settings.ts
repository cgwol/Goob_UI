import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

export type Sensitivity = "Low" | "Medium" | "High";
export type Theme = "Dark" | "Light" | "Forest" | "Ocean" | "Black";
export type Volume = "Off" | "Low" | "Medium" | "High";
export type WindowMode = "Windowed fullscreen" | "Fullscreen" | "Windowed";

const KEY = "sensitivity";
const THEME_KEY = "theme";
const ORDER: Sensitivity[] = ["Low", "Medium", "High"];
const THEMES: Theme[] = ["Dark", "Light", "Forest", "Ocean", "Black"];
const VOLUME_KEY = "volume";
const VOLUMES: Volume[] = ["Off", "Low", "Medium", "High"];
const WINDOW_KEY = "window-mode";
const WINDOW_MODES: WindowMode[] = ["Windowed fullscreen", "Fullscreen", "Windowed"];

let sensitivity: Sensitivity = load();
let theme: Theme = loadTheme();
const listeners = new Set<() => void>();
let volume: Volume = loadVolume();
let windowMode: WindowMode = loadWindow();

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

function applyTheme() {
  document.documentElement.className = `theme-${theme.toLowerCase()}`;
}

export function getSensitivity() {
  return sensitivity;
}

// export function cycleSensitivity() {
//   sensitivity = ORDER[(ORDER.indexOf(sensitivity) + 1) % ORDER.length];
//   localStorage.setItem(KEY, sensitivity);
//   emit();
//   return sensitivity;
// }

export function getDeadzone() {
  if (sensitivity === "High") return 0.35;
  if (sensitivity === "Low") return 0.75;
  return 0.55;
}

export function getTheme() {
  return theme;
}

// export function cycleTheme() {
//   theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
//   localStorage.setItem(THEME_KEY, theme);
//   applyTheme();
//   emit();
//   return theme;
// }

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
      listeners.delete(update)
    }
  }, []);
  return volume;
}


export function volumeLevel() {
  if (volume === "Off") return 0;
  if (volume === "Low") return 0.25;
  if (volume === "High") return 1;
  return 0.55;
}

function loadWindow(): WindowMode {
  const saved = localStorage.getItem(WINDOW_KEY);
  return WINDOW_MODES.includes(saved as WindowMode) ? (saved as WindowMode) : "Windowed";
}

export function getWindowMode() {
  return windowMode;
}

export async function applyWindowMode(mode: WindowMode) {
  const win = getCurrentWindow();
  if (mode === "Fullscreen") {
    await win.setDecorations(false);
    await win.setFullscreen(true);
    return;
  }
  await win.setFullscreen(false);
  if (mode === "Windowed fullscreen") {
    await win.setDecorations(false);
    await win.setResizable(true);
    await win.maximize();
    return;
  }
  await win.unmaximize();
  await win.setDecorations(true);
  await win.setResizable(true);
  await win.setSize(new LogicalSize(1280, 720));
  await win.center();
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
    return () => { listeners.delete(update) };
  }, []);
  return windowMode;
}

applyTheme();
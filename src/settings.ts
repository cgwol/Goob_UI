import { useEffect, useState } from "react";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";

export type Sensitivity = "Low" | "Medium" | "High";
export type Theme = "Dark" | "Light" | "Forest" | "Ocean" | "Black";
export type Volume = "Off" | "Low" | "Medium" | "High";
export type WindowMode = "Windowed fullscreen" | "Fullscreen" | "Windowed";

const KEY = "sensitivity";
const THEME_KEY = "theme";
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSensitivity() {
  return sensitivity;
}

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

async function coverMonitor() {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  if (!monitor) return;

  // Windows draws an invisible border inside a borderless window. Shift past it.
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
    await coverMonitor();
    return;
  }

  await win.setAlwaysOnTop(false);
  await win.unmaximize();
  await win.setDecorations(true);
  await win.setShadow(true).catch(() => {});
  await win.setResizable(true);

  const width = 1280;
  const height = 720;
  await win.setSize(new LogicalSize(width, height));
  await wait(80);

  const monitor = await currentMonitor();
  const outer = await win.outerSize().catch(() => null);
  if (monitor && outer) {
    const x = monitor.position.x + (monitor.size.width - outer.width) / 2;
    const y = monitor.position.y + (monitor.size.height - outer.height) / 2;
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  } else if (monitor) {
    const scale = monitor.scaleFactor;
    const x = monitor.position.x + (monitor.size.width - width * scale) / 2;
    const y = monitor.position.y + (monitor.size.height - height * scale) / 2;
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  } else {
    await win.center();
  }
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

applyTheme();

getCurrentWindow().onFocusChanged(({ payload: focused }) => {
  if (getWindowMode() !== "Windowed fullscreen") return;
  if (focused) {
    void coverMonitor();
  } else {
    void getCurrentWindow().setAlwaysOnTop(false);
  }
});
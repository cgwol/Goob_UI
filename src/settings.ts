import { useEffect, useState } from "react";

export type Sensitivity = "Low" | "Medium" | "High";
export type Theme = "Dark" | "Light" | "Forest" | "Ocean" | "Black";

const KEY = "sensitivity";
const THEME_KEY = "theme";
const ORDER: Sensitivity[] = ["Low", "Medium", "High"];
const THEMES: Theme[] = ["Dark", "Light", "Forest", "Ocean", "Black"];

let sensitivity: Sensitivity = load();
let theme: Theme = loadTheme();
const listeners = new Set<() => void>();

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

applyTheme();
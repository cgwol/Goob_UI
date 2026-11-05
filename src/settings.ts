import { useEffect, useState } from "react";

export type Sensitivity = "Low" | "Medium" | "High";

const KEY = "sensitivity";
const ORDER: Sensitivity[] = ["Low", "Medium", "High"];

let sensitivity: Sensitivity = load();
const listeners = new Set<() => void>();

function load(): Sensitivity {
  const saved = localStorage.getItem(KEY);
  return saved === "Low" || saved === "High" ? saved : "Medium";
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function getSensitivity() {
  return sensitivity;
}

export function cycleSensitivity() {
  sensitivity = ORDER[(ORDER.indexOf(sensitivity) + 1) % ORDER.length];
  localStorage.setItem(KEY, sensitivity);
  emit();
  return sensitivity;
}

export function getDeadzone() {
  if (sensitivity === "High") return 0.35;
  if (sensitivity === "Low") return 0.75;
  return 0.55;
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
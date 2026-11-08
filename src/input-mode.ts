/**
 * Tracks the active input mode (mouse, keyboard, or gamepad) and detected controller type for Goob UI.
 * Exports utilities to query the current mode, detect PlayStation/Xbox/Nintendo pads, and persist
 * the user's preferred controller legend (auto-detect or forced) in localStorage.
 * Filters out Steam virtual controllers so the real hardware pad is preferred.
 */
import { useEffect, useState } from "react";

export type InputMode = "mouse" | "keyboard" | "gamepad";
export type PadKind = "playstation" | "xbox" | "nintendo" | "generic";
export type PadChoice = "auto detection" | PadKind;

const PAD_KEY = "pad-legend";
const PAD_ORDER: PadChoice[] = ["auto detection", "playstation", "xbox", "nintendo", "generic"];

let mode: InputMode = "mouse";
let padKind: PadKind = "generic";
let padChoice: PadChoice = loadPad();
const listeners = new Set<() => void>();

// Load the saved controller legend preference, defaulting to auto detection
function loadPad(): PadChoice {
  const saved = localStorage.getItem(PAD_KEY);
  return PAD_ORDER.includes(saved as PadChoice) ? (saved as PadChoice) : "auto detection";
}

// Notify all React hooks that the mode or legend has changed
function emit() {
  listeners.forEach((fn) => fn());
}

/**
 * Update the global input mode. When switching to gamepad, optionally detect the pad type from its id.
 */
export function setInputMode(next: InputMode, id?: string) {
  if (next === "gamepad" && id) padKind = detectPad(id);
  if (mode === next && (next !== "gamepad" || !id)) return;
  mode = next;
  emit();
}

/**
 * Classify a Gamepad.id string into playstation, xbox, nintendo, or generic.
 */
export function detectPad(id: string): PadKind {
  const name = id.toLowerCase();
  if (name.includes("dualsense") || name.includes("dualshock") || name.includes("playstation") || name.includes("sony")) {
    return "playstation";
  }
  if (name.includes("xbox") || name.includes("xinput") || name.includes("microsoft")) return "xbox";
  if (name.includes("nintendo") || name.includes("switch") || name.includes("pro controller")) return "nintendo";
  return "generic";
}

export function getPadChoice() {
  return padChoice;
}

/**
 * Cycle to the next controller legend option and persist it.
 */
export function cyclePadChoice() {
  padChoice = PAD_ORDER[(PAD_ORDER.indexOf(padChoice) + 1) % PAD_ORDER.length];
  localStorage.setItem(PAD_KEY, padChoice);
  emit();
  return padChoice;
}

// Return the pad kind that should be shown in UI legends (user override or auto-detected)
function shownPad(): PadKind {
  return padChoice === "auto detection" ? padKind : padChoice;
}

/**
 * React hook that re-renders the component whenever the input mode or pad choice changes.
 */
export function useInputMode() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return { mode, padKind: shownPad(), padChoice };
}

/**
 * Return the preferred connected Gamepad, or null if the window is unfocused.
 * Prefers a non-Steam/virtual pad when multiple are present.
 */
export function getPad(): Gamepad | null {
  if (!document.hasFocus()) return null;
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter(
    (p): p is Gamepad => !!p?.connected,
  );
  const real = pads.find((p) => !/steam|virtual|valve/i.test(p.id));
  return real ?? pads[0] ?? null;
}

export function setPadChoice(next: PadChoice) {
  padChoice = next;
  localStorage.setItem(PAD_KEY, padChoice);
  emit();
}

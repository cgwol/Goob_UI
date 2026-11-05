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

function loadPad(): PadChoice {
  const saved = localStorage.getItem(PAD_KEY);
  return PAD_ORDER.includes(saved as PadChoice) ? (saved as PadChoice) : "auto detection";
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function setInputMode(next: InputMode, id?: string) {
  if (next === "gamepad" && id) padKind = detectPad(id);
  if (mode === next && (next !== "gamepad" || !id)) return;
  mode = next;
  emit();
}

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

export function cyclePadChoice() {
  padChoice = PAD_ORDER[(PAD_ORDER.indexOf(padChoice) + 1) % PAD_ORDER.length];
  localStorage.setItem(PAD_KEY, padChoice);
  emit();
  return padChoice;
}

function shownPad(): PadKind {
  return padChoice === "auto detection" ? padKind : padChoice;
}

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
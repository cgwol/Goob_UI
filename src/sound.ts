import { useEffect } from "react";
import { volumeLevel } from "./settings";
import { getPad } from "./input-mode";

let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function play(kind: "move" | "select") {
  const level = volumeLevel();
  if (!level) return;
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = kind === "select" ? 660 : 440;
  gain.gain.setValueAtTime(0.0001, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12 * level, ac.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.09);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.1);
}

export function useSystemSounds() {
  useEffect(() => {
    let last = "";

    const focusedId = () => {
      const el = document.querySelector(".focused");
      if (!el) return "";
      return el.className + "|" + (el.textContent ?? "");
    };

    const check = () => {
      const now = focusedId();
      if (now && now !== last) {
        if (last) play("move");
        last = now;
      }
    };

    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") play("select");
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("button")) play("select");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);

    let alive = true;
    let raf = 0;
    let prevCross = false;
    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      const cross = !!pad?.buttons[0]?.pressed;
      if (cross && !prevCross) play("select");
      prevCross = cross;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);
}
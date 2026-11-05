import { useEffect } from "react";
import { volumeLevel } from "./settings";
import { getPad } from "./input-mode";

let ctx: AudioContext | null = null;
let muteUntil = 0;

function audio() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
}

export function play(kind: "move" | "select" | "launch" | "menu") {
    const level = volumeLevel();
    if (!level) return;
    if (kind !== "launch" && kind !== "menu" && performance.now() < muteUntil) return;
    if (kind === "launch" || kind === "menu") muteUntil = performance.now() + 400;

    const ac = audio();
    const notes =
        kind === "launch" ? [392, 523, 659] : kind === "menu" ? [220, 330] : [kind === "select" ? 660 : 440];
    notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const start = ac.currentTime + i * 0.06;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.14 * level, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        osc.connect(gain).connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.16);
    });
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
            if (e.key === "Enter" || e.key === " ") setTimeout(() => play("select"), 0);
        };
        const onClick = (e: MouseEvent) => {
            if ((e.target as HTMLElement | null)?.closest("button, .tile")) setTimeout(() => play("select"), 0);
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
            if (cross && !prevCross) setTimeout(() => play("select"), 0);
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
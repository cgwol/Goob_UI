import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useInputMode } from "../input-mode";

const ITEMS = ["Home", "Settings", "Close"] as const;
const POWER = ["Minimize", "Close app", "Sleep", "Power off"] as const;

export function SideMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(0);
  const [powerOpen, setPowerOpen] = useState(false);
  const focusedRef = useRef(focused);
  const powerRef = useRef(powerOpen);
  focusedRef.current = focused;
  powerRef.current = powerOpen;
  const { mode, padKind } = useInputMode();
  const menuIcon =
    mode === "keyboard"
      ? "Esc"
      : mode === "gamepad" && padKind === "playstation"
        ? "OPTIONS"
        : mode === "gamepad"
          ? "☰"
          : "";

  const items = powerOpen ? POWER : ITEMS;

  const choose = async (label: string) => {
    if (label === "Home") navigate("/");
    if (label === "Settings") navigate("/settings");
    if (label === "Close") {
      setPowerOpen(true);
      setFocused(0);
      return;
    }
    if (label === "Minimize") await getCurrentWindow().minimize();
    if (label === "Close app") await getCurrentWindow().close();
    if (label === "Sleep") await invoke("system_action", { action: "sleep" });
    if (label === "Power off")
      await invoke("system_action", { action: "shutdown" });
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setPowerOpen(false);
      return;
    }
    setFocused(0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "ArrowLeft") {
        if (powerRef.current) {
          setPowerOpen(false);
          setFocused(0);
          return;
        }
        onClose();
      }
      if (e.key === "ArrowUp") {
        setFocused(
          (f) =>
            (f - 1 + (powerRef.current ? POWER.length : ITEMS.length)) %
            (powerRef.current ? POWER.length : ITEMS.length),
        );
      }
      if (e.key === "ArrowDown") {
        setFocused(
          (f) => (f + 1) % (powerRef.current ? POWER.length : ITEMS.length),
        );
      }
      if (e.key === "Enter")
        choose((powerRef.current ? POWER : ITEMS)[focusedRef.current]);
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevUp = false;
    let prevDown = false;
    let prevCross = false;
    let prevClose = false;
    let armed = false;

    const tick = () => {
      if (!alive) return;
      const pad = Array.from(navigator.getGamepads?.() ?? []).find(
        (p) => p?.connected,
      );
      if (pad) {
        const up = (pad.axes[1] ?? 0) < -0.6 || !!pad.buttons[12]?.pressed;
        const down = (pad.axes[1] ?? 0) > 0.6 || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const count = powerRef.current ? POWER.length : ITEMS.length;

        if (up && !prevUp) setFocused((f) => (f - 1 + count) % count);
        if (down && !prevDown) setFocused((f) => (f + 1) % count);
        if (cross && !prevCross)
          choose((powerRef.current ? POWER : ITEMS)[focusedRef.current]);

        if (!circle && !ps && !start) armed = true;
        if (armed && (circle || ps || start) && !prevClose) {
          if (powerRef.current) {
            setPowerOpen(false);
            setFocused(0);
          } else {
            onClose();
          }
        }

        prevUp = up;
        prevDown = down;
        prevCross = cross;
        prevClose = circle || ps || start;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <aside className="side-menu" onClick={(e) => e.stopPropagation()}>
        <span className="menu-title">
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          {powerOpen ? "Power" : "Menu"}
        </span>
        {items.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i === focused ? "menu-item focused" : "menu-item"}
            onMouseEnter={() => setFocused(i)}
            onClick={() => choose(label)}
          >
            {label}
          </button>
        ))}
      </aside>
    </div>
  );
}

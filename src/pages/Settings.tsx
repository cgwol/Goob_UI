import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { SideMenu } from "../components/SideMenu";
import { cycleSensitivity, getDeadzone, useSensitivity } from "../settings";
import { useInputMode, getPad, cyclePadChoice } from "../input-mode";

const ITEMS = ["Start with Windows", "Controller Stick Sensitivity", "Controller Legend"] as const;

export function Settings() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { mode, padKind, padChoice } = useInputMode();
  const sensitivity = useSensitivity();

  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const [startup, setStartup] = useState(false);

  useEffect(() => {
    isEnabled().then(setStartup).catch((err) => console.error(err));
  }, []);

  const toggleStartup = async () => {
    try {
      if (startup) {
        await disable();
        setStartup(false);
      } else {
        await enable();
        setStartup(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const choose = () => {
    const item = ITEMS[focusedRef.current];
    if (item === "Start with Windows") void toggleStartup();
    if (item === "Controller Stick Sensitivity") cycleSensitivity();
    if (item === "Controller Legend") cyclePadChoice();
  };

  const value = (label: (typeof ITEMS)[number]) => {
    if (label === "Start with Windows") return startup ? "On" : "Off";
    if (label === "Controller Stick Sensitivity") return sensitivity;
    return padChoice === "auto detection" ? "Auto" : padChoice[0].toUpperCase() + padChoice.slice(1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        navigate("/");
      }
      if (e.key === "Escape" && !menuOpenRef.current) {
        setMenuOpen(true);
        return;
      }
      if (menuOpenRef.current) return;
      if (e.key === "ArrowUp") setFocused((f) => (f - 1 + ITEMS.length) % ITEMS.length);
      if (e.key === "ArrowDown") setFocused((f) => (f + 1) % ITEMS.length);
      if (e.key === "Enter") choose();
    };
    window.addEventListener("keydown", onKey);

    let alive = true;
    let raf = 0;
    let prevCircle = false;
    let prevMenu = false;
    let prevCross = false;
    let armed = false;
    let armedCross = false;
    let holdDir: "up" | "down" | null = null;
    let holdSince = 0;
    let lastFire = 0;

    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      if (pad) {
        const zone = getDeadzone();
        const y = pad.axes[1] ?? 0;
        const up = y < -zone || !!pad.buttons[12]?.pressed;
        const down = y > zone || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const now = performance.now();

        if (!ps && !start) armed = true;
        if (armed && !menuOpenRef.current && (ps || start) && !prevMenu) setMenuOpen(true);
        if (circle && !prevCircle && !menuOpenRef.current) navigate("/");

        if (!menuOpenRef.current) {
          const active = up && !down ? "up" : down && !up ? "down" : null;
          if (active !== holdDir) {
            holdDir = active;
            holdSince = now;
            lastFire = now;
            if (active === "up") setFocused((f) => (f - 1 + ITEMS.length) % ITEMS.length);
            if (active === "down") setFocused((f) => (f + 1) % ITEMS.length);
          } else if (active && now - holdSince >= 420 && now - lastFire >= 180) {
            lastFire = now;
            if (active === "up") setFocused((f) => (f - 1 + ITEMS.length) % ITEMS.length);
            if (active === "down") setFocused((f) => (f + 1) % ITEMS.length);
          }

          if (!cross) armedCross = true;
          if (armedCross && cross && !prevCross) choose();
        }

        prevCircle = circle;
        prevMenu = ps || start;
        prevCross = cross;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate, startup]);

  const backIcon =
    mode === "keyboard" ? "⌫" : mode === "gamepad" && padKind === "playstation" ? "○" : mode === "gamepad" ? "B" : "";
  const menuIcon =
    mode === "keyboard" ? "Esc" : mode === "gamepad" && padKind === "playstation" ? "OPTIONS" : mode === "gamepad" ? "☰" : "";

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setMenuOpen(true)}>
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          Settings
        </span>
        <span className="clock">
          {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </header>

      <div className="settings">
        {ITEMS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i === focused ? "setting focused" : "setting"}
            onMouseEnter={() => setFocused(i)}
            onClick={() => {
              setFocused(i);
              if (label === "Start with Windows") void toggleStartup();
              if (label === "Controller Stick Sensitivity") cycleSensitivity();
              if (label === "Controller Legend") cyclePadChoice();
            }}
          >
            <span>{label}</span>
            <span className="setting-value">{value(label)}</span>
          </button>
        ))}
      </div>

      <button type="button" className="back" onClick={() => navigate("/")}>
        {backIcon && <span className="keycap">{backIcon}</span>}
        Back
      </button>
      <SideMenu open={menuOpen} onClose={closeMenu} />
    </div>
  );
}
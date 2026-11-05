import "./App.css";
import { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
// import { Page } from "./pages/Page";
import { SideMenu } from "./components/SideMenu";
import { setInputMode, useInputMode, getPad } from "./input-mode";
import { Games } from "./pages/Games";
import { Apps } from "./pages/Apps";
import { Settings } from "./pages/Settings";
import { getDeadzone, applyWindowMode, getWindowMode } from "./settings";
import { useSystemSounds } from "./sound";

const TILES = ["Games", "Apps", "Settings"];

function useCursorMode() {
  useEffect(() => {
    type Mode = "mouse" | "keyboard" | "gamepad";
    let mode: Mode = "mouse";
    let shown = true;
    let lastNonMouse = 0;
    let lastPaint = 0;

    const paint = (visible: boolean, force = false) => {
      const now = performance.now();
      if (!force && visible === shown) return;
      if (force && visible === shown && now - lastPaint < 80) return;
      shown = visible;
      lastPaint = now;
      document.body.classList.toggle("cursor-hidden", !visible);
      void invoke("set_os_cursor", { visible }).catch(() => {});
    };

    const hide = (next: Exclude<Mode, "mouse">, padId?: string) => {
      mode = next;
      lastNonMouse = performance.now();
      if (next === "gamepad" && padId) setInputMode("gamepad", padId);
      else setInputMode(next);
      paint(false, true);
    };

    const show = () => {
      if (mode === "mouse" && shown) return;
      mode = "mouse";
      setInputMode("mouse");
      paint(true, true);
    };

    const onKey = () => hide("keyboard");

    const onMouseMove = (e: MouseEvent) => {
      const moved = Math.abs(e.movementX) + Math.abs(e.movementY);
      if (mode !== "mouse") {
        // Fullscreen injects tiny moves on focus. A real move still switches over.
        if (performance.now() - lastNonMouse < 350 || moved < 8) {
          paint(false, true);
          return;
        }
      }
      if (moved < 2) return;
      show();
    };

    const onMouseDown = () => {
      if (mode !== "mouse" && performance.now() - lastNonMouse < 350) {
        paint(false, true);
        return;
      }
      show();
    };

    const onWheel = () => {
      if (mode !== "mouse" && performance.now() - lastNonMouse < 350) return;
      show();
    };

    const onFocus = () => {
      if (document.hidden) return;
      if (mode !== "mouse") {
        lastNonMouse = performance.now();
        paint(false, true);
      }
    };

    // ShowCursor is process-wide. Give the cursor back when leaving the app.
    const onBlur = () => {
      if (mode !== "mouse") void invoke("set_os_cursor", { visible: true }).catch(() => {});
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("wheel", onWheel);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onFocus);

    let alive = true;
    let raf = 0;
    let wasActive = false;

    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      if (pad) {
        const x = pad.axes[0] ?? 0;
        const y = pad.axes[1] ?? 0;
        const stick = Math.abs(x) > 0.4 || Math.abs(y) > 0.4;
        const pressed = pad.buttons.some((b) => b.pressed);
        const active = stick || pressed;
        if (active && (!wasActive || mode !== "gamepad" || shown)) hide("gamepad", pad.id);
        wasActive = active;
      } else {
        wasActive = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onFocus);
      document.body.classList.remove("cursor-hidden");
      void invoke("set_os_cursor", { visible: true }).catch(() => {});
    };
  }, []);
}

function Home() {
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const { mode, padKind } = useInputMode();
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuIcon =
    mode === "keyboard"
      ? "Esc"
      : mode === "gamepad" && padKind === "playstation"
        ? "OPTIONS"
        : mode === "gamepad"
          ? "\u2630"
          : "";

  const open = () => navigate("/" + TILES[focusedRef.current].toLowerCase());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!menuOpenRef.current) setMenuOpen(true);
        return;
      }
      if (menuOpenRef.current) return;
      if (e.key === "ArrowLeft") {
        setFocused((f) => (f - 1 + TILES.length) % TILES.length);
      }
      if (e.key === "ArrowRight") {
        setFocused((f) => (f + 1) % TILES.length);
      }
      if (e.key === "Enter" || e.key === " ") open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let prevCross = false;
    let prevMenu = false;
    let armed = false;
    let holdDir: "left" | "right" | null = null;
    let holdSince = 0;
    let lastFire = 0;
    const HOLD_DELAY = 420;
    const REPEAT = 180;

    const move = (dir: "left" | "right") => {
      setFocused((f) =>
        dir === "left"
          ? (f - 1 + TILES.length) % TILES.length
          : (f + 1) % TILES.length,
      );
    };

    const tick = () => {
      if (!alive) return;
      const pad = getPad();

      if (pad) {
        const zone = getDeadzone();
        const x = pad.axes[0] ?? 0;
        const left = x < -zone || !!pad.buttons[14]?.pressed;
        const right = x > zone || !!pad.buttons[15]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;
        const now = performance.now();

        if (!menuOpenRef.current) {
          const active =
            left && !right ? "left" : right && !left ? "right" : null;

          if (active !== holdDir) {
            holdDir = active;
            holdSince = now;
            lastFire = now;
            if (active) move(active);
          } else if (
            active &&
            now - holdSince >= HOLD_DELAY &&
            now - lastFire >= REPEAT
          ) {
            lastFire = now;
            move(active);
          }

          if (cross && !prevCross) open();
        }

        if (!circle && !ps && !start) armed = true;
        if (
          armed &&
          !menuOpenRef.current &&
          (circle || ps || start) &&
          !prevMenu
        ) {
          setMenuOpen(true);
        }
        prevCross = cross;
        prevMenu = circle || ps || start;
      } else {
        prevCross = false;
        prevMenu = false;
        holdDir = null;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setMenuOpen(true)}>
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          Home
        </span>
        <span className="clock">
          {new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </header>
      <div className="row">
        {TILES.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i === focused ? "tile focused" : "tile"}
            onMouseEnter={() => setFocused(i)}
            onClick={() => navigate("/" + label.toLowerCase())}
          >
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </div>
      <SideMenu open={menuOpen} onClose={closeMenu} />
    </div>
  );
}

export default function App() {
  useCursorMode();
  useSystemSounds();
  useEffect(() => {
    void applyWindowMode(getWindowMode());
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/games" element={<Games />} />
      <Route path="/apps" element={<Apps />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

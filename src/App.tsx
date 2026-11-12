/**
 * Root application component for Goob UI.
 * Defines the top-level routes (Home, Games, Apps, Settings) and wires up
 * global behaviors that should run for the lifetime of the app:
 * - System sounds
 * - Initial application of the saved window mode
 *
 * The Home screen is a simple horizontal tile row that navigates to the three main sections.
 */
import "./App.css";
import goobIcon from './assets/32x32.png'
import { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { SideMenu } from "./components/SideMenu";
import { setInputMode, useInputMode, getPad } from "./input-mode";
import { Games } from "./pages/Games";
import { Apps } from "./pages/Apps";
import { Settings } from "./pages/Settings";
import { getDeadzone, useCursorMode, applyWindowMode, getWindowMode, applyConfigSettings } from "./settings";
import { useSystemSounds } from "./sound";
import { initConfig } from "./config";

const TILES = ["Games", "Apps", "Settings"];

/**
 * Tracks whether the user is driving the UI with keyboard, mouse, or gamepad
 * so button legends can update, and hides the cursor based on the setting.
 */
function useInputTracker() {
  const cursorMode = useCursorMode();
  const { mode } = useInputMode();

  useEffect(() => {
    // While this is recent, the controller poll must not steal the mode back.
    let lastPointer = 0;
    const notePointer = (next: "mouse" | "keyboard") => {
      lastPointer = performance.now();
      setInputMode(next);
    };

    const onKey = () => notePointer("keyboard");
    // movementX is often 0 in the Tauri webview, so track the pointer position.
    let lastX = -1;
    let lastY = -1;
    const onMouse = (e: MouseEvent) => {
      if (lastX < 0) {
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      const moved = Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if (moved > 2) notePointer("mouse");
    };
    const onMouseDown = () => notePointer("mouse");
    const onWheel = () => notePointer("mouse");

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("wheel", onWheel);

    let alive = true;
    let raf = 0;
    let prevStick = false;
    let prevPressed = false;

    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      // Ignore the pad briefly after mouse or keyboard so it cannot override them.
      if (pad && performance.now() - lastPointer > 300) {
        const x = pad.axes[0] ?? 0;
        const y = pad.axes[1] ?? 0;
        const stick = Math.abs(x) > 0.6 || Math.abs(y) > 0.6;
        const pressed = pad.buttons.some((b) => b.pressed);
        // Only on a new press or a new stick deflection, not on jitter.
        if ((stick && !prevStick) || (pressed && !prevPressed)) {
          setInputMode("gamepad", pad.id);
        }
        prevStick = stick;
        prevPressed = pressed;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    const shouldHide =
      cursorMode === "Off at All Times" ||
      (cursorMode === "Off When Using a Controller" && mode === "gamepad");

    const id = "goob-hide-cursor";
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (shouldHide) {
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        // Transparent 1x1 PNG custom cursor — works more reliably than cursor:none in Tauri/WebView2 on Windows
        style.textContent =
          "html, body, body * { cursor: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=') 0 0, none !important; }";
        document.head.appendChild(style);
      }
    } else if (style) {
      style.remove();
    }

    return () => document.getElementById(id)?.remove();
  }, [cursorMode, mode]);
}

/**
 * Home screen: a horizontal row of three large tiles (Games, Apps, Settings).
 * Navigation is driven by arrow keys or the left stick / D-pad, with hold-to-repeat.
 * Enter / Cross activates the focused tile. Escape / Options opens the side menu.
 */
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
          ? "☰"
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

          // Hold-to-repeat logic for the stick / D-pad
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

        // Arm so the button that opened the menu does not immediately close it
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
          <img className="brand-icon" src={goobIcon} alt="" />
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
  useInputTracker();
  useSystemSounds();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      await initConfig();
      applyConfigSettings();
      void applyWindowMode(getWindowMode());
      setReady(true);
    })();
  }, []);
  if (!ready) return null;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/games" element={<Games />} />
      <Route path="/apps" element={<Apps />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
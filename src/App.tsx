import "./App.css";
import { useEffect, useState, useRef } from "react";

const TILES = ["Games", "Apps", "Settings"];

function App() {
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  // Keyboard Support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setFocused((f) => (f - 1 + TILES.length) % TILES.length);
      }
      if (e.key === "ArrowRight") {
        setFocused((f) => (f + 1) % TILES.length);
      }
      if (e.key === "Enter" || e.key === " ") {
        console.log("Selected:", TILES[focused]);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused]);

  // Gamepad support
  useEffect(() => {
    let alive = true;
    let raf = 0;
    let prevLeft = false;
    let prevRight = false;
    let prevCross = false;
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
      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((p) => p?.connected) ?? null;

      if (pad) {
        const x = pad.axes[0] ?? 0;
        const left = x < -0.6 || !!pad.buttons[14]?.pressed;
        const right = x > 0.6 || !!pad.buttons[15]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const now = performance.now();

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

        if (cross && !prevCross) {
          console.log("Selected:", TILES[focusedRef.current]);
        }

        prevLeft = left;
        prevRight = right;
        prevCross = cross;
      } else {
        prevLeft = prevRight = prevCross = false;
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

  // Cursor Logic
  useEffect(() => {
    const hide = () => document.body.classList.add("cursor-hidden");
    const show = () => document.body.classList.remove("cursor-hidden");

    // Hide when using keyboard or gamepad
    const onKey = () => hide();
    window.addEventListener("keydown", onKey);

    let raf = 0;
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((p) => p?.connected);
      if (pad) {
        const moved =
          Math.abs(pad.axes[0] ?? 0) > 0.4 ||
          Math.abs(pad.axes[1] ?? 0) > 0.4 ||
          pad.buttons.some((b) => b.pressed);
        if (moved) hide();
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);

    // Show again on any mouse activity
    window.addEventListener("mousemove", show);
    window.addEventListener("mousedown", show);
    window.addEventListener("wheel", show);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", show);
      window.removeEventListener("mousedown", show);
      window.removeEventListener("wheel", show);
    };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Home</span>
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
            onClick={() => console.log("Selected:", label)}
          >
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;

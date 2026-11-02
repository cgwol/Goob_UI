import "./App.css";
import { useEffect, useState, useRef } from "react";

const TILES = ["Games", "Apps", "Settings", "Library"];

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

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        background: "#111",
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      {TILES.map((label, i) => (
        <div
          key={label}
          onMouseEnter={() => setFocused(i)}
          onClick={() => console.log("Selected:", label)}
          style={{
            width: 180,
            height: 180,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.4rem",
            fontWeight: 600,
            background: i === focused ? "#1e90ff" : "#2a2a2a",
            transform: i === focused ? "scale(1.15)" : "scale(1)",
            boxShadow: i === focused ? "0 0 30px #1e90ff88" : "none",
            transition: "all 0.15s ease",
            cursor: "pointer",
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

export default App;

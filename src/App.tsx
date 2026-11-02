import "./App.css";
import { useEffect, useState } from "react";

const TILES = ["Games", "Apps", "Settings", "Library"];

function App() {
  const [focused, setFocused] = useState(0);

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

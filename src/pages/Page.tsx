/**
 * Shared page chrome used by the Games, Apps, and Settings screens.
 * Renders the top bar (title + clock), a Back button, and the SideMenu.
 * Handles the global "go back" action (Backspace or Circle) and "open menu" action
 * (Escape or Options/Start/PS button).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SideMenu } from "../components/SideMenu";
import { useInputMode, getPad } from "../input-mode";

export function Page({ title }: { title: string }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const { mode, padKind } = useInputMode();
  // Adaptive button legends for the Back control
  const backIcon =
    mode === "keyboard"
      ? "⌫"
      : mode === "gamepad" && padKind === "playstation"
        ? "○"
        : mode === "gamepad"
          ? "B"
          : "";
  const menuIcon =
    mode === "keyboard"
      ? "Esc"
      : mode === "gamepad" && padKind === "playstation"
        ? "OPTIONS"
        : mode === "gamepad"
          ? "☰"
          : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        navigate("/");
      }
      if (e.key === "Escape" && !menuOpenRef.current) setMenuOpen(true);
    };
    window.addEventListener("keydown", onKey);

    // Poll gamepad for Circle (back) and Options/Start (menu)
    let alive = true;
    let raf = 0;
    let prevCircle = false;
    let prevMenu = false;
    let armed = false;

    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      if (pad) {
        const circle = !!pad.buttons[1]?.pressed;
        const ps = !!pad.buttons[16]?.pressed;
        const start = !!pad.buttons[9]?.pressed;

        if (circle && !prevCircle && !menuOpenRef.current) navigate("/");

        if (!ps && !start) armed = true;
        if (armed && !menuOpenRef.current && (ps || start) && !prevMenu) {
          setMenuOpen(true);
        }

        prevCircle = circle;
        prevMenu = ps || start;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand" onClick={() => setMenuOpen(true)}>
          {menuIcon && <span className="keycap">{menuIcon}</span>}
          {title}
        </span>
        <span className="clock">
          {new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </header>
      <button type="button" className="back" onClick={() => navigate("/")}>
        {backIcon && <span className="keycap">{backIcon}</span>}
        Back
      </button>
      <SideMenu open={menuOpen} onClose={closeMenu} />
    </div>
  );
}

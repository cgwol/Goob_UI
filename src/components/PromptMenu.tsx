/**
 * Reusable modal popup component used throughout Goob UI.
 * Displays a title, optional body content, and a vertical list of action buttons.
 * Supports keyboard (arrow keys + Enter/Escape) and gamepad (stick + Cross/Circle) navigation.
 * Includes a short ignore window after opening so that the button that triggered the popup
 * does not immediately activate an action.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getPad } from "../input-mode";
import { getDeadzone } from "../settings";

export type PopupAction = {
  label: string;
  onSelect: () => void;
};

export function Popup({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  actions: PopupAction[];
  onClose: () => void;
}) {
  const [focused, setFocused] = useState(0);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const actionsRef = useRef(actions);
  const onCloseRef = useRef(onClose);
  actionsRef.current = actions;
  onCloseRef.current = onClose;
  const ignore = useRef(true); // Prevent accidental activation right after the popup opens

  useEffect(() => {
    // Blur any focused input so keyboard events are not swallowed by a form field
    (document.activeElement as HTMLElement | null)?.blur?.();
    const arm = setTimeout(() => {
      ignore.current = false;
    }, 400);

    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement).tagName === "INPUT";
      if (e.key === "Escape" || e.key === "Backspace") {
        if (e.key === "Backspace" && inField) return; // allow typing
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (inField) return;
      const list = actionsRef.current;
      if (e.key === "ArrowUp") setFocused((f) => (f - 1 + list.length) % list.length);
      if (e.key === "ArrowDown") setFocused((f) => (f + 1) % list.length);
      if (e.key === "Enter") list[focusedRef.current]?.onSelect();
    };
    window.addEventListener("keydown", onKey);

    // Gamepad navigation loop with hold-to-repeat on the stick
    let alive = true;
    let raf = 0;
    let prevCross = false;
    let prevClose = false;
    let armed = false;
    let holdDir: "up" | "down" | null = null;
    let holdSince = 0;
    let lastFire = 0;

    const tick = () => {
      if (!alive) return;
      const pad = getPad();
      const list = actionsRef.current;
      if (pad) {
        const zone = getDeadzone();
        const y = pad.axes[1] ?? 0;
        const up = y < -zone || !!pad.buttons[12]?.pressed;
        const down = y > zone || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const triangle = !!pad.buttons[3]?.pressed;
        const now = performance.now();
        const inField = document.activeElement?.tagName === "INPUT";

        if (!cross && !circle && !triangle && !up && !down) armed = true;

        if (armed && !inField && !ignore.current) {
          const active = up && !down ? "up" : down && !up ? "down" : null;
          if (active !== holdDir) {
            holdDir = active;
            holdSince = now;
            lastFire = now;
            if (active === "up") setFocused((f) => (f - 1 + list.length) % list.length);
            if (active === "down") setFocused((f) => (f + 1) % list.length);
          } else if (active && now - holdSince >= 420 && now - lastFire >= 180) {
            lastFire = now;
            if (active === "up") setFocused((f) => (f - 1 + list.length) % list.length);
            if (active === "down") setFocused((f) => (f + 1) % list.length);
          }

          if (cross && !prevCross) list[focusedRef.current]?.onSelect();
          if (circle && !prevClose) onCloseRef.current();
        }

        prevCross = cross;
        prevClose = circle;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      clearTimeout(arm);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="popup-backdrop"
      onClick={() => {
        if (!ignore.current) onCloseRef.current();
      }}
    >
      <section className="popup" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="popup-title">{title}</header>
        {children && <div className="popup-body">{children}</div>}
        <div className="popup-actions">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              className={i === focused ? "menu-item focused" : "menu-item"}
              onMouseEnter={() => setFocused(i)}
              onClick={(e) => {
                e.stopPropagation();
                if (ignore.current) return;
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

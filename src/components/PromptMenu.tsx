import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const actionsRef = useRef(actions); // CHANGE
  const onCloseRef = useRef(onClose); // CHANGE
  actionsRef.current = actions;
  onCloseRef.current = onClose;

  useEffect(() => {
    // CHANGE: blur once on open, not on every re-render
    (document.activeElement as HTMLElement | null)?.blur?.();

    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement).tagName === "INPUT";
      if (e.key === "Escape") onCloseRef.current();
      if (inField) return;
      const list = actionsRef.current;
      if (e.key === "ArrowUp") setFocused((f) => (f - 1 + list.length) % list.length);
      if (e.key === "ArrowDown") setFocused((f) => (f + 1) % list.length);
      if (e.key === "Enter") list[focusedRef.current]?.onSelect();
    };
    window.addEventListener("keydown", onKey);

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
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
      const list = actionsRef.current;
      if (pad) {
        const up = (pad.axes[1] ?? 0) < -0.6 || !!pad.buttons[12]?.pressed;
        const down = (pad.axes[1] ?? 0) > 0.6 || !!pad.buttons[13]?.pressed;
        const cross = !!pad.buttons[0]?.pressed;
        const circle = !!pad.buttons[1]?.pressed;
        const triangle = !!pad.buttons[3]?.pressed;
        const now = performance.now();
        const inField = document.activeElement?.tagName === "INPUT";

        if (!cross && !circle && !triangle && !up && !down) armed = true;

        if (armed && !inField) {
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
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // CHANGE: run once, so typing does not restart this and blur the field
  }, []);

  return (
    <div className="popup-backdrop" onClick={onClose}>
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
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}